import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { SimilarityExtractionWorkflow } from '@vm-x-ai/aws-cdk-constructs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class SimilarityExtractionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const { similaritySearchFn, extractionFn, embeddingFn } = new SimilarityExtractionWorkflow(
      this,
      'similarity-extraction',
      {
        stateMachine: {
          extractionInputPayload: {
            'model.$': '$.model',
            'schema.$': '$.schema',
            'instructions.$': '$.instructions',
          },
        },
      },
    );

    [similaritySearchFn, extractionFn, embeddingFn].forEach((fn) => {
      fn.addEnvironment('OPENAI_API_KEY_SSM', '/dev/openai/api-key');
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/dev/openai/api-key`],
        }),
      );
    });
  }
}
