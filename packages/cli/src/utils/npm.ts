import chalk from 'chalk';
import { logger } from '../logger';
import { spawnPromise } from './cmd';

export async function installNpmPackages(packages: { name: string; version: string }[]) {
  packages.forEach((pkg) => {
    logger.info(chalk.bold` - Installing {blue ${pkg.name}}`);
  });

  await spawnPromise(
    [
      'npm',
      'install',
      '--save-dev',
      packages.map((pkg) => (pkg.version ? `${pkg.name}@${pkg.version}` : `${pkg.name}`)).join(' '),
    ].join(' '),
  );
}
