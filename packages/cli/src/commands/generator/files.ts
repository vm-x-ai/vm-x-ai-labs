import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ejs from 'ejs';
import { logger } from '../../logger';
import { isBinaryPath } from '../../utils';

export async function generateFiles(directory: string, outputDir: string, data: Record<string, unknown>) {
  for await (const file of getFiles(directory)) {
    const targetPath = computePath(directory, outputDir, file, data);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    let newContent: Buffer | string;

    if (isBinaryPath(file)) {
      newContent = await fs.readFile(file);
    } else {
      const template = await fs.readFile(file, 'utf-8');
      newContent = ejs.render(template, data, {
        filename: file,
      });
    }
    await fs.writeFile(targetPath, newContent);
    logger.info(chalk`{green CREATE} ${path.relative(process.cwd(), targetPath)}`);
  }
}

async function* getFiles(dir: string): AsyncGenerator<string> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

function computePath(
  srcFolder: string,
  target: string,
  filePath: string,
  substitutions: Record<string, unknown>,
): string {
  const relativeFromSrcFolder = path.relative(srcFolder, filePath);
  let computedPath = path.join(target, relativeFromSrcFolder);
  if (computedPath.endsWith('.template')) {
    computedPath = computedPath.substring(0, computedPath.length - 9);
  }
  Object.entries(substitutions).forEach(([propertyName, value]) => {
    computedPath = computedPath.split(`__${propertyName}__`).join(value as string);
  });
  return computedPath;
}
