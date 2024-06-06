import type { CloudProviders, GlobalArgs, MonorepoTools, ProgrammingLanguages } from '../../../types';

export type AIExtractionProjectGeneratorArgs = {
  name: string;
  provider: CloudProviders;
  language: ProgrammingLanguages;
  monorepoTool?: MonorepoTools;
  deploy?: boolean;
  awsProfile?: string;
  awsRegion?: string;
} & GlobalArgs;
