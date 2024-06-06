import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { logger } from '../../logger';
import { spawnPromise } from '../cmd';

export function writeNxProjectConfig(projectDirectory: string, projectConfigJson: Record<string, unknown>): void {
  fs.writeFileSync(path.join(projectDirectory, 'project.json'), JSON.stringify(projectConfigJson, null, 2));
}

export function writeNxJson(nxJson: Record<string, unknown>): void {
  logger.debug('Updating nx.json file');
  fs.writeFileSync('nx.json', JSON.stringify(nxJson, null, 2));
}

export function readNxJson(): Record<string, unknown> {
  logger.debug('Checking if nx.json exists');
  if (!fs.existsSync('nx.json')) {
    logger.error(chalk.bold`${logSymbols.error} Cannot find nx.json file in Nx workspace`);
    process.exit(1);
  }
  logger.debug('Reading nx.json file');
  const nxJson = JSON.parse(fs.readFileSync('nx.json', 'utf-8'));
  return nxJson;
}

export async function runNxFormat(): Promise<void> {
  logger.info(chalk.bold`${logSymbols.info} Running Nx format...`);
  await spawnPromise('npx nx format');
}

export function readNxProjectConfig(projectRoot: string): Record<string, unknown> {
  const projectConfigPath = path.join(projectRoot, 'project.json');

  logger.debug(`Checking if ${projectConfigPath} exists`);
  if (!fs.existsSync(projectConfigPath)) {
    logger.error(chalk.bold`${logSymbols.error} Cannot find ${projectConfigPath} file in Nx workspace`);
    process.exit(1);
  }
  logger.debug(`Reading ${projectConfigPath} file`);
  const projectConfigJson = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
  return projectConfigJson;
}
