#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimilarityExtractionStack } from './stacks/similarity-extraction-stack';

const app = new cdk.App();

new SimilarityExtractionStack(app, 'faiss-similarity-extraction', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
