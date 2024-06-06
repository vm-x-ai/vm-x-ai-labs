#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { AIExtractionProjectGeneratorArgs } from '../src/commands';
import {
  SupportedAIExtractionCloudProviders,
  SupportedAIExtractionMonorepoTools,
  SupportedAIExtractionProgrammingLanguages,
  aiExtractionProjectGenerator,
} from '../src/commands';
import { yargsDecorator } from '../src/decorator';
import { logger, setGlobalLevel } from '../src/logger';
import type { CloudProviders, MonorepoTools, ProgrammingLanguages } from '../src/types';
import { promptConfirmIfUndefined, promptIfUndefined, type EnquirerChoice } from '../src/utils/enquirer';

const enquirerChoiceMapping: Record<string, Record<string, EnquirerChoice>> = {
  cloudProviders: {
    aws: {
      name: 'aws',
      value: 'aws',
      message: 'Amazon Web Services (AWS)',
    },
  },
  monorepoTools: {
    nx: {
      name: 'nx',
      value: 'nx',
      message: 'Nx (Nx.dev) [https://nx.dev/getting-started/intro]',
    },
  },
  languages: {
    python: {
      name: 'python',
      value: 'python',
      message: 'Python (with Poetry)',
    },
  },
};

yargs(hideBin(process.argv))
  .scriptName('vm-x-ai')
  .command('generate', 'Generate a new project', (yargs) => {
    return yargs
      .command(
        'ai-extraction [name]',
        'Generate a new AI extraction project',
        (yargs) => {
          const builder = yargs
            .positional('name', {
              type: 'string',
              description: 'Project name',
            })
            .option('provider', {
              type: 'string',
              description: 'Cloud provider',
              choices: SupportedAIExtractionCloudProviders,
            })
            .option('monorepo-tool', {
              type: 'string',
              description: 'Monorepo tool',
              choices: SupportedAIExtractionMonorepoTools,
            })
            .option('language', {
              type: 'string',
              description: 'Programming language',
              choices: SupportedAIExtractionProgrammingLanguages,
            })
            .option('deploy', {
              type: 'boolean',
              description: 'Automatically deploy the project after generation',
            })
            .option('interactive', {
              type: 'boolean',
              description: 'Run in interactive mode',
              default: process.env.CI !== 'true',
            })
            .option('aws-profile', {
              type: 'string',
              description: 'AWS profile, could only be used when the provider is set to "aws"',
            })
            .option('aws-region', {
              type: 'string',
              description: 'AWS Region, could only be used when the provider is set to "aws"',
            });

          builder.check((argv) => {
            if (argv.interactive) return true;

            ['name', 'provider', 'language'].forEach((arg) => {
              if (!argv[arg]) {
                throw new Error(`Missing required argument: ${arg}`);
              }
            });

            return true;
          });

          return builder;
        },
        async (argv) => {
          logger.debug({ argv }, 'Starting vm-x generate ai-extraction command...');
          const handlerArgs: Partial<AIExtractionProjectGeneratorArgs> = {
            interactive: argv.interactive,
            verbose: (argv.verbose as boolean) || false,
            deploy: argv.deploy,
            awsProfile: argv.awsProfile,
            awsRegion: argv.awsRegion,
          };

          handlerArgs.name = await promptIfUndefined(
            argv.name,
            {
              name: 'name',
              message: 'Project name',
              type: 'input',
              required: true,
            },
            argv.interactive,
          );

          handlerArgs.provider = await promptIfUndefined<CloudProviders>(
            argv.provider,
            {
              name: 'provider',
              message: 'Choose a Cloud provider',
              type: 'select',
              choices: SupportedAIExtractionCloudProviders.map(
                (provider) => enquirerChoiceMapping.cloudProviders[provider],
              ),
            },
            argv.interactive,
          );

          const monorepoEnabled = await promptConfirmIfUndefined(
            argv.monorepoTool,
            {
              message: 'Do you want to generate the project in a monorepo style?',
            },
            argv.interactive,
          );

          if (monorepoEnabled) {
            handlerArgs.monorepoTool = await promptIfUndefined<MonorepoTools>(
              argv.monorepoTool,
              {
                name: 'monorepoTool',
                message: 'Choose a Monorepo tool',
                choices: SupportedAIExtractionMonorepoTools.map((tool) => enquirerChoiceMapping.monorepoTools[tool]),
                type: 'select',
              },
              argv.interactive,
            );
          }

          handlerArgs.language = await promptIfUndefined<ProgrammingLanguages>(
            argv.language,
            {
              name: 'language',
              message: 'Choose a programming language',
              choices: SupportedAIExtractionProgrammingLanguages.map((lang) => enquirerChoiceMapping.languages[lang]),
              type: 'select',
            },
            argv.interactive,
          );

          try {
            await aiExtractionProjectGenerator(handlerArgs as AIExtractionProjectGeneratorArgs);
          } catch (error) {
            if (argv.verbose) {
              logger.error(error);
            }

            process.exit(1);
          }
        },
      )
      .demandCommand(1, 'Choose a command from the list above');
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    global: true,
  })
  .demandCommand(1, 'Choose a command from the list above')
  .updateLocale(yargsDecorator)
  .middleware((argv) => {
    setGlobalLevel(argv.verbose ? 'debug' : 'info');
  })
  .strict()
  .parse();
