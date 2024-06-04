import type { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

export async function isStackExists(cfnClient: CloudFormationClient, stackName: string) {
  try {
    await cfnClient.send(
      new DescribeStacksCommand({
        StackName: stackName,
      }),
    );
    return true;
  } catch (error) {
    if ((error as Error).message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}
