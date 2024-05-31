/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import type { FunctionProps, LayerVersionProps } from 'aws-cdk-lib/aws-lambda';
import { Function, Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { BucketProps } from 'aws-cdk-lib/aws-s3';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Chain } from 'aws-cdk-lib/aws-stepfunctions';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import {
  DefinitionBody,
  LogLevel,
  CustomState,
  StateGraph,
  TaskInput,
  Pass,
  JsonPath,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as tar from 'tar';

export type SimilarityExtractionWorkflowProps = {
  stagingBucketProps?: BucketProps;
  projectRoot?: string;
  lambdas?: {
    layerProps?: Partial<LayerVersionProps>;
    splitFn?: {
      fn?: cdk.aws_lambda.Function;
      props?: Partial<FunctionProps>;
    };
    embeddingFn?: {
      fn?: cdk.aws_lambda.Function;
      props?: Partial<FunctionProps>;
    };
    similaritySearchFn?: {
      fn?: cdk.aws_lambda.Function;
      props?: Partial<FunctionProps>;
    };
    extractionFn?: {
      fn?: cdk.aws_lambda.Function;
      props?: Partial<FunctionProps>;
    };
  };
};

export type PythonBuildArtifact = {
  wheelFile: string;
  tarGzFile: string;
  sourceArtifactPath: string;
  sourceArtifactPackages: string[];
};

export class SimilarityExtractionWorkflow extends Construct {
  public readonly splitFn: cdk.aws_lambda.Function;
  public readonly embeddingFn: cdk.aws_lambda.Function;
  public readonly similaritySearchFn: cdk.aws_lambda.Function;
  public readonly extractionFn: cdk.aws_lambda.Function;
  public readonly stagingBucket: Bucket;
  public readonly stateMachine: StateMachine;
  public readonly stateMachineDefinitionBody: Chain;

  private readonly runtime = Runtime.PYTHON_3_10;

  private get region() {
    return cdk.Stack.of(this).region;
  }

  constructor(scope: Construct, id: string, props?: SimilarityExtractionWorkflowProps) {
    super(scope, id);

    const projectRoot = props?.projectRoot || process.cwd();

    this.stagingBucket = new Bucket(this, 'StagingBucket', {
      bucketName: `${id}-staging-bucket-${this.region}`,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7),
          id: 'DeleteAfter7Days',
          enabled: true,
        },
      ],
      ...(props?.stagingBucketProps || {}),
    });

    const buildArtifact = this.getBuildArfifact(projectRoot);
    const assetHash = this.getPoetryLockHash(projectRoot);

    if (
      (!props?.lambdas?.splitFn ||
        !props?.lambdas?.embeddingFn ||
        !props?.lambdas?.similaritySearchFn ||
        !props?.lambdas?.extractionFn) &&
      (!buildArtifact || !assetHash)
    ) {
      throw new Error(
        'When not providing all the lambdas, a python build artifact must be present in the project root.',
      );
    }

    const dependenciesLayer = new LayerVersion(this, 'DependenciesLayers', {
      compatibleRuntimes: [this.runtime],
      layerVersionName: `${id}-deps-python-layer`,
      code: Code.fromAsset(path.join(projectRoot, 'dist'), {
        bundling: {
          image: this.runtime.bundlingImage,
          command: this.getLayerBundlingCommand(buildArtifact!),
        },
        assetHashType: cdk.AssetHashType.CUSTOM,
        assetHash,
      }),
      ...(props?.lambdas?.layerProps || {}),
    });

    const layers = [dependenciesLayer];

    this.splitFn =
      props?.lambdas?.splitFn?.fn ||
      this.addSplitFunction(id, buildArtifact!, {
        ...(props?.lambdas?.splitFn?.props || {}),
        layers: [...layers, ...(props?.lambdas?.splitFn?.props?.layers || [])],
      });
    this.embeddingFn =
      props?.lambdas?.embeddingFn?.fn ||
      this.addEmbeddingFunction(id, buildArtifact!, {
        ...(props?.lambdas?.embeddingFn?.props || {}),
        layers: [...layers, ...(props?.lambdas?.embeddingFn?.props?.layers || [])],
      });
    this.similaritySearchFn =
      props?.lambdas?.similaritySearchFn?.fn ||
      this.addSimilaritySearchFunction(id, buildArtifact!, {
        ...(props?.lambdas?.similaritySearchFn?.props || {}),
        layers: [...layers, ...(props?.lambdas?.similaritySearchFn?.props?.layers || [])],
      });
    this.extractionFn =
      props?.lambdas?.extractionFn?.fn ||
      this.addExtractionFunction(id, buildArtifact!, {
        ...(props?.lambdas?.extractionFn?.props || {}),
        layers: [...layers, ...(props?.lambdas?.extractionFn?.props?.layers || [])],
      });

    [this.splitFn, this.embeddingFn, this.similaritySearchFn, this.extractionFn].forEach((fn) => {
      this.stagingBucket.grantReadWrite(fn);
      fn.addEnvironment('STAGING_BUCKET', this.stagingBucket.bucketName);
    });

    const logGroup = new LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/stepfunctions/states/${id}-workflow`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const role = new Role(this, 'StateMachineRole', {
      roleName: `${id}-workflow-${this.region}`,
      assumedBy: new ServicePrincipal('states.amazonaws.com'),
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['states:StartExecution', 'states:DescribeExecution', 'states:StopExecution'],
        resources: ['*'],
      }),
    );

    this.stagingBucket.grantReadWrite(role);
    [this.embeddingFn, this.extractionFn].forEach((fn) => fn.grantInvoke(role));

    const defaultVariables = new Pass(this, 'Set Default Variables', {
      result: {
        value: {
          max_concurrency: 10,
          tolerated_failure_percentage: 0,
          similarity_search_max_results: 5,
        },
      },
      resultPath: '$.defaults',
    });

    const applyDefaults = new Pass(this, 'Apply Defaults', {
      resultPath: '$.with_defaults',
      outputPath: '$.with_defaults.args',
      parameters: {
        args: JsonPath.jsonMerge(JsonPath.objectAt('$.defaults'), JsonPath.objectAt('$$.Execution.Input')),
      },
    });

    const splitFnTask = new LambdaInvoke(this, 'Split Input', {
      lambdaFunction: this.splitFn,
      resultPath: '$.split_result',
      resultSelector: {
        'key_prefix.$': '$.Payload.key_prefix',
      },
      payload: TaskInput.fromObject({
        execution_id: JsonPath.stringAt('$$.Execution.Name'),
      }),
    });

    const embeddingFnTask = new LambdaInvoke(this, 'Embedding Chunk', {
      lambdaFunction: this.embeddingFn,
      resultPath: '$.embedding_item_result',
      resultSelector: {
        'bucket.$': '$.Payload.bucket',
        'object_key.$': '$.Payload.object_key',
      },
      outputPath: '$.embedding_item_result',
    });

    const embeddingMap = new CustomState(this, 'Embedding Map', {
      stateJson: {
        Type: 'Map',
        MaxConcurrencyPath: '$.max_concurrency',
        ToleratedFailurePercentagePath: '$.tolerated_failure_percentage',
        ItemReader: {
          Resource: 'arn:aws:states:::s3:listObjectsV2',
          Parameters: {
            Bucket: this.stagingBucket.bucketName,
            'Prefix.$': '$.split_result.key_prefix',
          },
        },
        ItemProcessor: {
          ProcessorConfig: {
            Mode: 'DISTRIBUTED',
            ExecutionType: 'STANDARD',
          },
          ...new StateGraph(embeddingFnTask, 'DistributedMapGraph').toGraphJson(),
        },
        ResultWriter: {
          Resource: 'arn:aws:states:::s3:putObject',
          Parameters: {
            Bucket: this.stagingBucket.bucketName,
            'Prefix.$':
              "States.Format('date={}/execution_id={}/embedding/output', States.ArrayGetItem(States.StringSplit($$.State.EnteredTime, 'T'), 0), $$.Execution.Name)",
          },
        },
        ResultPath: '$.embedding_result',
      },
    });

    const similaritySearchFnTask = new LambdaInvoke(this, 'Similarity Search', {
      lambdaFunction: this.similaritySearchFn,
      resultPath: '$.similarity_search_result',
      resultSelector: {
        'bucket.$': '$.Payload.bucket',
        'object_key.$': '$.Payload.object_key',
      },
      payload: TaskInput.fromObject({
        bucket: JsonPath.stringAt('$.embedding_result.ResultWriterDetails.Bucket'),
        manifest_key: JsonPath.stringAt('$.embedding_result.ResultWriterDetails.Key'),
        execution_id: JsonPath.stringAt('$$.Execution.Name'),
        query: JsonPath.stringAt('$.similarity_search_query'),
        max_results: JsonPath.numberAt('$.similarity_search_max_results'),
      }),
    });

    const extractionFnTask = new LambdaInvoke(this, 'LLM Extraction', {
      lambdaFunction: this.extractionFn,
    });

    const extractionMap = new CustomState(this, 'Extraction Map', {
      stateJson: {
        Type: 'Map',
        MaxConcurrencyPath: '$.max_concurrency',
        ToleratedFailurePercentagePath: '$.tolerated_failure_percentage',
        ItemReader: {
          Resource: 'arn:aws:states:::s3:getObject',
          ReaderConfig: {
            InputType: 'JSON',
          },
          Parameters: {
            'Bucket.$': '$.similarity_search_result.bucket',
            'Key.$': '$.similarity_search_result.object_key',
          },
        },
        ItemSelector: {
          'item.$': '$$.Map.Item.Value',
          'execution_id.$': '$$.Execution.Name',
          'model.$': '$.model',
          'schema.$': '$.schema',
          'instructions.$': '$.instructions',
        },
        ItemProcessor: {
          ProcessorConfig: {
            Mode: 'DISTRIBUTED',
            ExecutionType: 'STANDARD',
          },
          ...new StateGraph(extractionFnTask, 'DistributedMapGraph').toGraphJson(),
        },
      },
    });

    const definitionBody = defaultVariables
      .next(applyDefaults)
      .next(splitFnTask)
      .next(embeddingMap)
      .next(similaritySearchFnTask)
      .next(extractionMap);

    this.stateMachineDefinitionBody = definitionBody;
    this.stateMachine = new StateMachine(this, 'StateMachine', {
      stateMachineName: `${id}-workflow`,
      definitionBody: DefinitionBody.fromChainable(definitionBody),
      logs: {
        level: LogLevel.ALL,
        destination: logGroup,
      },
      role,
      tracingEnabled: true,
      comment: 'One-time AI extraction workflow',
    });
  }

  private getPoetryLockHash(projectRoot: string): string | undefined {
    if (!fs.existsSync(path.join(projectRoot, 'poetry.lock'))) {
      return undefined;
    }

    const hashSum = crypto.createHash('sha256');
    hashSum.update(fs.readFileSync(path.join(projectRoot, 'poetry.lock')));
    return hashSum.digest('hex');
  }

  private getBuildArfifact(projectRoot: string): PythonBuildArtifact | undefined {
    const distDir = path.join(projectRoot, 'dist');
    if (!fs.existsSync(distDir)) {
      return undefined;
    }

    const wheelFile = fs.readdirSync(distDir).find((file) => file.endsWith('.whl'));
    const tarGzFile = fs.readdirSync(distDir).find((file) => file.endsWith('.tar.gz'));

    if (!wheelFile || !tarGzFile) {
      return undefined;
    }

    tar.extract({
      file: path.join(projectRoot, 'dist', tarGzFile),
      sync: true,
      cwd: distDir,
    });

    const sourceArtifactPath = path.join(projectRoot, 'dist', tarGzFile.replace('.tar.gz', ''));
    const sourceArtifactPackages = fs
      .readdirSync(sourceArtifactPath)
      .filter((file) => fs.lstatSync(path.join(sourceArtifactPath, file)).isDirectory());

    return { wheelFile, tarGzFile, sourceArtifactPath, sourceArtifactPackages };
  }

  private addSplitFunction(baseName: string, buildArtifact: PythonBuildArtifact, props?: Partial<FunctionProps>) {
    const splitFn = new Function(this, 'SplitFunction', {
      functionName: `${baseName}-split`,
      runtime: this.runtime,
      handler: 'lambda_functions/split/main.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      code: this.getLambdaCode(buildArtifact),
      ...(props || {}),
    });
    return splitFn;
  }

  private addEmbeddingFunction(baseName: string, buildArtifact: PythonBuildArtifact, props?: Partial<FunctionProps>) {
    const embeddingFn = new Function(this, 'EmbeddingFunction', {
      functionName: `${baseName}-embedding`,
      runtime: this.runtime,
      handler: 'lambda_functions/embedding/main.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      code: this.getLambdaCode(buildArtifact),
      ...(props || {}),
    });
    return embeddingFn;
  }

  private addSimilaritySearchFunction(
    baseName: string,
    buildArtifact: PythonBuildArtifact,
    props?: Partial<FunctionProps>,
  ) {
    const similaritySearchFn = new Function(this, 'SimilaritySearchFunction', {
      functionName: `${baseName}-similarity-search`,
      runtime: this.runtime,
      handler: 'lambda_functions/search/main.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      code: this.getLambdaCode(buildArtifact),
      ...(props || {}),
    });

    return similaritySearchFn;
  }

  private addExtractionFunction(baseName: string, buildArtifact: PythonBuildArtifact, props?: Partial<FunctionProps>) {
    const extractionFn = new Function(this, 'ExtractionFunction', {
      functionName: `${baseName}-llm-extraction`,
      runtime: this.runtime,
      handler: 'lambda_functions/extraction/main.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      code: this.getLambdaCode(buildArtifact),
      ...(props || {}),
    });

    return extractionFn;
  }

  private getLayerBundlingCommand(buildArtifact: PythonBuildArtifact, extra?: string): string[] {
    const extraCommand = extra ? `[${extra}]` : '';
    return [
      'bash',
      '-c',
      [
        `pip install ${buildArtifact.wheelFile}${extraCommand} --target /asset-output/python`,
        `rm -rf ${[
          '/asset-output/python/**/*.dist-info',
          '/asset-output/python/**/*.egg-info',
          '/asset-output/python/**/__pycache__',
          ...buildArtifact.sourceArtifactPackages.map((pkg) => `/asset-output/python/${pkg}`),
        ].join(' ')}`,
      ].join(' && '),
    ];
  }

  private getLambdaCode(buildArtifact: PythonBuildArtifact): Code {
    return Code.fromAsset(buildArtifact.sourceArtifactPath, {
      exclude: fs
        .readdirSync(buildArtifact.sourceArtifactPath)
        .filter((path) => !buildArtifact.sourceArtifactPackages.includes(path)),
    });
  }
}
