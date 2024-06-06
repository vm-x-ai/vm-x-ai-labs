import fs from 'fs';
import path from 'path';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { EC2Client, DescribeRegionsCommand } from '@aws-sdk/client-ec2';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from '@smithy/types';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { logger } from '../../../logger';
import {
  installNpmPackages,
  isStackExists,
  promptConfirmIfUndefined,
  promptIfUndefined,
  readNxJson,
  readNxProjectConfig,
  runNxFormat,
  writeNxJson,
  writeNxProjectConfig,
} from '../../../utils';
import { isInstalled, spawnPromise } from '../../../utils/cmd';
import { generateFiles } from '../files';
import { GeneratorLifecycleRunner } from '../runner';
import type { AIExtractionProjectGeneratorArgs } from './types';

type AIExtractionProjectGeneratorLifecycle =
  | 'check:prerequisites'
  | 'generate:workspace'
  | 'generate:project'
  | 'deploy:project'
  | 'finalize:project';

const runner = new GeneratorLifecycleRunner<
  AIExtractionProjectGeneratorLifecycle,
  AIExtractionProjectGeneratorArgs,
  {
    projectName?: string;
    projectDirectory?: string;
    awsProfile?: string;
    awsRegion?: string;
    awsCrendentials?: AwsCredentialIdentityProvider;
  }
>();

runner.register(
  'check:prerequisites',
  {
    description: 'Check if npx and npm are installed',
    when: async (args) => args.monorepoTool === 'nx',
    run: async () => {
      if (!(await isInstalled('npx'))) {
        throw new Error('npx is required to generate Nx workspace');
      } else if (!(await isInstalled('npm'))) {
        throw new Error('npm is required to generate Nx workspace');
      }
    },
  },
  {
    description: 'Check if python and poetry are installed',
    when: async (args) => args.language === 'python',
    run: async () => {
      if (!(await isInstalled('python'))) {
        throw new Error('python is required to manage Python versions');
      } else if (!(await isInstalled('poetry'))) {
        throw new Error('poetry is required to generate Python project');
      }
    },
  },
  {
    description: 'Check if AWS CLI is installed',
    when: async (args) => args.provider === 'aws',
    run: async () => {
      if (!(await isInstalled('aws'))) {
        throw new Error('AWS CLI is required to deploy to AWS');
      }
    },
  },
);

runner.register(
  'generate:workspace',
  {
    description: 'Generate Nx workspace',
    startLog: 'Creating Nx workspace...',
    endLog: 'Nx workspace created successfully',
    when: async (args) => args.monorepoTool === 'nx',
    run: async (args) => {
      await spawnPromise(`npx --yes create-nx-workspace --preset=ts --workspaceType=integrated --ci=skip ${args.name}`);
      const workspaceRoot = path.join(process.cwd(), args.name);
      process.chdir(workspaceRoot);
    },
  },
  {
    description: 'Add AWS CDK to Nx workspace',
    startLog: 'Adding AWS CDK to Nx workspace...',
    endLog: 'AWS CDK libraries added to Nx workspace',
    when: async (args) => args.monorepoTool === 'nx' && args.provider === 'aws',
    run: async () => {
      await installNpmPackages([
        { name: '@vm-x-ai/aws-cdk-constructs', version: '' },
        { name: 'aws-cdk', version: '' },
        { name: 'aws-cdk-lib', version: '' },
        { name: 'ts-paths-esm-loader', version: '' },
        { name: 'tsconfig-paths', version: '' },
        { name: 'source-map-support', version: '' },
      ]);
    },
  },
  {
    description: 'Add Python plugin to Nx workspace',
    startLog: 'Adding Python plugin to Nx workspace...',
    endLog: 'Python plugin added to Nx workspace',
    when: async (args) => args.monorepoTool === 'nx' && args.language === 'python',
    run: async () => {
      await installNpmPackages([{ name: '@nxlv/python', version: '' }]);
      const nxJson = readNxJson();
      nxJson.plugins = ['@nxlv/python'];
      nxJson.generators = {
        '@nxlv/python:poetry-project': {
          pyprojectPythonDependency: '>=3.9,<4',
          linter: 'ruff',
          pyenvPythonVersion: '3.9.5',
        },
        '@nxlv/python:migrate-to-shared-venv': {
          pyprojectPythonDependency: '>=3.9,<4',
          pyenvPythonVersion: '3.9.5',
        },
      };
      writeNxJson(nxJson);
    },
  },
  {
    description: 'Initialize CDK project',
    startLog: 'Initializing CDK project...',
    endLog: 'CDK project initialized successfully',
    when: async (args) => args.monorepoTool === undefined && args.provider === 'aws',
    run: async (args) => {
      const projectRoot = path.join(process.cwd(), args.name);
      if (fs.existsSync(projectRoot)) {
        logger.error(chalk`{red.bold ${projectRoot} already exists}`);
        throw new Error('Project directory already exists');
      }

      fs.mkdirSync(projectRoot);
      process.chdir(projectRoot);
      await spawnPromise('npx --yes cdk init app --language=typescript');
    },
  },
);

runner.register(
  'generate:project',
  {
    description: 'Generate AI extraction project',
    context: {
      projectName: 'ai-extraction',
      projectDirectory: 'packages/workflows/ai-extraction',
    },
    startLog: 'Generating AI extraction project...',
    endLog: 'Python AI extraction project generated successfully',
    when: async (args) => args.monorepoTool === 'nx' && args.language === 'python',
    run: async (_, { context }) => {
      await spawnPromise(
        [
          'npx',
          'nx',
          'generate',
          '@nxlv/python:poetry-project',
          `--name=${context.projectName}`,
          `--directory=${context.projectDirectory}`,
          '--description="AWS Serverless Implementation of Langchain Long File Structured Extraction"',
          '--moduleName=lambda_functions',
          '--packageName=ai-extraction',
          `--templateDir=${path.join(import.meta.dirname || __dirname, 'files', 'nx')}`,
        ].join(' '),
      );

      await spawnPromise(['npx', 'nx', 'generate', '@nxlv/python:migrate-to-shared-venv'].join(' '));
    },
  },
  {
    description: 'Generate AI extraction project',
    startLog: 'Generating AI extraction project...',
    endLog: 'Python AI extraction project generated successfully',
    when: async (args) => args.monorepoTool === undefined && args.language === 'python',
    run: async (args) => {
      fs.rmdirSync('bin', { recursive: true });
      fs.rmdirSync('lib', { recursive: true });
      fs.rmdirSync('test', { recursive: true });

      const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
      cdkJson.app = cdkJson.app.replace('bin/my-project.ts', 'bin/main.ts');
      fs.writeFileSync('cdk.json', JSON.stringify(cdkJson, null, 2));
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      delete packageJson.bin;

      packageJson.scripts = {
        ...packageJson.scripts,
        build: 'poetry build',
        'cdk:deploy': "npm run build && cdk deploy '*' --require-approval never",
      };

      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      await installNpmPackages([{ name: '@vm-x-ai/aws-cdk-constructs', version: '' }]);

      await generateFiles(path.join(import.meta.dirname || __dirname, 'files', 'standard'), process.cwd(), {
        dot: '.',
        pyenvPythonVersion: '3.9.5',
        moduleName: 'lambda_functions',
        codeCoverage: true,
        unitTestRunner: 'pytest',
        pythonAddopts: [
          '--cov',
          "--cov-report html:'reports/coverage/html'",
          "--cov-report xml:'reports/coverage/coverage.xml'",
          "--html='reports/unittests/html/index.html'",
          "--junitxml='reports/unittests/junit.xml'",
        ].join(' '),
        packageName: 'ai-extraction',
        description: 'AWS Serverless Implementation of Langchain Long File Structured Extraction',
        pyprojectPythonDependency: '>=3.9,<4',
        individualPackage: true,
        devDependenciesProject: '',
        linter: 'ruff',
        codeCoverageHtmlReport: true,
        projectName: args.name,
        devDependenciesProjectPkgName: '',
      });

      await spawnPromise('poetry install');
    },
  },
  {
    description: 'Add AWS CDK deploy target to Nx workspace',
    when: async (args) => args.monorepoTool === 'nx' && args.provider === 'aws',
    run: async (_, { context }) => {
      const nxJson = readNxJson();
      logger.debug('Adding AWS CDK deploy target to nx.json');
      nxJson.targetDefaults = {
        ...(nxJson.targetDefaults || {}),
        deploy: {
          executor: 'nx:run-commands',
          options: {
            command: "pnpm cdk deploy '*' --require-approval never -c stage={args.stage} --concurrency 10",
            cwd: '{projectRoot}',
          },
          configurations: {},
          dependsOn: ['build'],
        },
      };

      writeNxJson(nxJson);
      if (!context.projectName || !context.projectDirectory) {
        throw new Error('Project name or directory is missing');
      }

      const projectConfigJson = readNxProjectConfig(context.projectDirectory);

      projectConfigJson.targets = {
        ...(projectConfigJson.targets || {}),
        deploy: {},
      };

      writeNxProjectConfig(context.projectDirectory, projectConfigJson);
    },
  },
  {
    description: 'Format Files',
    when: async (args) => args.monorepoTool === 'nx',
    run: async () => runNxFormat(),
  },
);

runner.register(
  'deploy:project',
  {
    description: 'Deploy the project',
    stategy: 'break',
    when: async (args) =>
      await promptConfirmIfUndefined(
        args.deploy,
        {
          message: chalk`\nDo you want to deploy the project to your {blue ${args.provider}} environment?`,
        },
        args.interactive,
      ),
  },
  {
    description: 'Define AWS profile and region',
    when: async (args) => args.provider === 'aws',
    run: async (args, runner) => {
      const awsProfiles = (
        await spawnPromise('aws configure list-profiles', {
          captureOutput: true,
          output: false,
        })
      ).output
        .split('\n')
        .map((profile) => profile.trim())
        .filter((profile) => profile);

      const awsProfile = await promptIfUndefined(
        args.awsProfile || process.env.AWS_PROFILE,
        {
          name: 'awsProfile',
          message: 'Do you want to use a specific AWS profile?',
          type: 'autocomplete',
          choices: awsProfiles,
        },
        args.interactive,
      );

      logger.debug({ awsProfile }, 'Fetching AWS regions...');
      const awsSdkCredentials =
        awsProfile && awsProfile !== 'default'
          ? fromIni({
              profile: awsProfile,
            })
          : undefined;

      const profileRegion =
        !process.env.AWS_REGION && awsProfile
          ? (
              await spawnPromise(`aws configure get region --profile ${awsProfile}`, {
                captureOutput: true,
                output: false,
              })
            ).output.trim()
          : 'us-east-1';

      const ec2Client = new EC2Client({
        credentials: awsSdkCredentials,
        region: profileRegion,
      });

      const regions = await ec2Client.send(new DescribeRegionsCommand({}));

      const awsRegion = await promptIfUndefined(
        args.awsRegion || process.env.AWS_REGION,
        {
          name: 'awsRegiom',
          message: 'Do you want to use a specific AWS region?',
          type: 'autocomplete',
          choices: regions.Regions?.map((region) => region.RegionName || '') || [],
          maxChoices: 5,
          initial: regions.Regions?.findIndex((region) => region.RegionName === profileRegion) || 0,
        },
        args.interactive,
      );

      runner.appendContext({
        awsProfile,
        awsRegion,
        awsCrendentials: awsSdkCredentials,
      });
    },
  },
  {
    description: 'Bootstrap CDK',
    startLog: 'CDK bootstrap stack does not exist. Bootstrapping CDK',
    endLog: 'CDK bootstrapped successfully',
    when: async (args, { context }) => {
      return (
        args.provider === 'aws' &&
        !(await isStackExists(
          new CloudFormationClient({
            credentials: context.awsCrendentials,
            region: context.awsRegion,
          }),
          'CDKToolkit',
        ))
      );
    },
    run: async (_, { context }) => {
      const stsClient = new STSClient({
        credentials: context.awsCrendentials,
        region: context.awsRegion,
      });
      const caller = await stsClient.send(new GetCallerIdentityCommand({}));
      await spawnPromise(`npx cdk bootstrap aws://${caller.Account}/${context.awsRegion}`, {
        envVars: {
          AWS_PROFILE: context.awsProfile,
          AWS_REGION: context.awsRegion,
        },
      });
    },
  },
  {
    description: 'Deploy Nx CDK Project',
    startLog: 'Deploying AI extraction project...',
    endLog: 'AI extraction project deployed successfully',
    when: async (args) => args.monorepoTool === 'nx' && args.provider === 'aws',
    run: async (args, { context }) => {
      await spawnPromise(`npx nx run ${context.projectName}:deploy`, {
        envVars: {
          AWS_PROFILE: context.awsProfile,
          AWS_REGION: context.awsRegion,
        },
      });
    },
  },
  {
    description: 'Deploy CDK Project',
    startLog: 'Deploying AI extraction project...',
    endLog: 'AI extraction project deployed successfully',
    when: async (args) => args.monorepoTool === undefined && args.provider === 'aws',
    run: async (args, { context }) => {
      await spawnPromise(`npm run cdk:deploy`, {
        envVars: {
          AWS_PROFILE: context.awsProfile,
          AWS_REGION: context.awsRegion,
        },
      });
    },
  },
);

runner.register(
  'finalize:project',
  {
    when: async () => true,
    run: async (args) => {
      logger.info(chalk`\n - {blue cd ${args.name}}`);
    },
  },
  {
    when: async (args) => args.monorepoTool === 'nx',
    run: async (_, { context: { projectName } }) => {
      logger.info(chalk` - {blue.bold npx nx run ${projectName}:deploy} to deploy the project.`);
    },
  },
  {
    when: async (args) => args.monorepoTool === undefined,
    run: async () => {
      logger.info(chalk` - {blue.bold npm run cdk:deploy} to deploy the project.`);
    },
  },
  {
    when: async () => true,
    run: async () => {
      logger.info(
        chalk`\n - Documentation: {blue https://github.com/vm-x-ai/vm-x-ai-labs/tree/main/packages/aws/cdk/constructs#similarityextractionworkflow}`,
      );

      logger.info(chalk.bold`\n\n${logSymbols.success} It's all set!, Happy coding! 🚀`);
    },
  },
);

export const aiExtractionProjectGenerator = async (args: AIExtractionProjectGeneratorArgs) => {
  logger.debug({ args }, 'Generating AI extraction project...');

  await runner.run('check:prerequisites', args);
  await runner.run('generate:workspace', args);
  await runner.run('generate:project', args);
  await runner.run('deploy:project', args);
  await runner.run('finalize:project', args);
};
