import chalk from 'chalk';

export const yargsDecorator = {
  'Commands:': `${chalk.green`Commands`}:`,
  'Options:': `${chalk.green`Options`}:`,
  'Positionals:': `${chalk.green`Positionals`}:`,
  'Examples:': `${chalk.green`Examples`}:`,
  boolean: `${chalk.blue`boolean`}`,
  count: `${chalk.blue`count`}`,
  string: `${chalk.blue`string`}`,
  array: `${chalk.blue`array`}`,
  required: `${chalk.blue`required`}`,
  'default:': `${chalk.blue`default`}:`,
  'choices:': `${chalk.blue`choices`}:`,
  'aliases:': `${chalk.blue`aliases`}:`,
};
