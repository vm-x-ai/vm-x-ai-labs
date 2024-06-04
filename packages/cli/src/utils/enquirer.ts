import { prompt } from 'enquirer';

type Fn = () => unknown;
export type EnquirerPromptOptions = Exclude<Exclude<Parameters<typeof prompt>[0], Fn>, (unknown | Fn)[]>;
export type EnquirerChoice = Extract<EnquirerPromptOptions, { choices: unknown[] }>['choices'][number];

export async function promptConfirmIfUndefined(
  value: unknown,
  promptOptions: Omit<EnquirerPromptOptions, 'name' | 'type'>,
  interactive = true,
): Promise<boolean> {
  if (value === undefined && interactive) {
    return (
      await prompt<{ value: boolean }>({
        ...promptOptions,
        type: 'confirm',
        name: 'value',
      })
    ).value;
  }
  return !!value;
}

export async function promptIfUndefined<T>(
  value: T | undefined,
  promptOptions: EnquirerPromptOptions,
  interactive = true,
): Promise<T | undefined> {
  if (value === undefined && interactive) {
    if ('choices' in promptOptions && promptOptions.choices.length === 0) {
      return undefined;
    }

    return (await prompt<Record<string, T>>(promptOptions))[promptOptions.name as string];
  }
  return value;
}
