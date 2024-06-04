import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { logger } from '../../logger';

type HandlerStategy = 'continue' | 'break';

type HandlerDefinition<
  TLifecycle extends string = string,
  TPayload = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> = {
  description?: string;
  startLog?: string;
  endLog?: string;
  stategy: HandlerStategy;
  context?: Partial<TContext>;
  run?: (payload: TPayload, runner: GeneratorLifecycleRunner<TLifecycle, TPayload, TContext>) => Promise<void>;
  when: (payload: TPayload, runner: GeneratorLifecycleRunner<TLifecycle, TPayload, TContext>) => Promise<boolean>;
};

type HandlerDefinitionInput<
  TLifecycle extends string = string,
  TPayload = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> = Omit<HandlerDefinition<TLifecycle, TPayload, TContext>, 'stategy'> & {
  stategy?: HandlerStategy;
};

export class GeneratorLifecycleRunner<
  TLifecycle extends string = string,
  TPayload = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> {
  public context: TContext = {} as TContext;
  protected handlers: Record<string, HandlerDefinition<TLifecycle, TPayload, TContext>[]> = {};

  public appendContext(context: Partial<TContext>) {
    this.context = {
      ...this.context,
      ...context,
    };
  }

  public register(lifecycle: TLifecycle, ...handlers: HandlerDefinitionInput<TLifecycle, TPayload, TContext>[]) {
    this.handlers[lifecycle] = this.handlers[lifecycle] || [];
    handlers.forEach((handler) => {
      if (handler.context) {
        this.appendContext(handler.context);
      }

      this.handlers[lifecycle].push({
        ...handler,
        stategy: handler.stategy || 'continue',
      });
    });
  }

  public async run(lifecycle: TLifecycle, payload: TPayload): Promise<void> {
    try {
      const handlers = this.handlers[lifecycle] || [];
      for (const handler of handlers) {
        const shouldRun = await handler.when(payload, this);
        if (!shouldRun && handler.stategy === 'break') {
          break;
        }

        if (shouldRun && handler.run) {
          if (handler.startLog) {
            logger.info(chalk.bold`${logSymbols.info} ${handler.startLog}`);
          }
          await handler.run(payload, this);

          if (handler.endLog) {
            logger.info(chalk.bold`${logSymbols.success} ${handler.endLog}`);
          }
        }
      }
    } catch (error) {
      logger.error(chalk.bold`${logSymbols.error} ${(error as Error).message}`);
      throw error;
    }
  }
}
