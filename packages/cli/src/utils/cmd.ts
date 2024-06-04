import type { SpawnSyncOptions } from 'child_process';
import { spawn } from 'child_process';
import commandExists from 'command-exists';
import { logger } from '../logger';

export type SpawnPromiseResult = {
  success: boolean;
  code: number | null;
  output: string;
};

export async function isInstalled(command: string): Promise<boolean> {
  try {
    await commandExists(command);
    return true;
  } catch (error) {
    return false;
  }
}

export const spawnPromise = function (
  command: string,
  cwd: string = process.cwd(),
  envVars?: Record<string, string | undefined>,
  output = false,
): Promise<SpawnPromiseResult> {
  return new Promise((resolve, reject) => {
    logger.debug(`Running command: ${command}`);
    const env: Record<string, string> = {
      ...process.env,
      ...(envVars ?? {}),
      ...(output ? { FORCE_COLOR: 'true' } : {}),
    };

    const args: SpawnSyncOptions = {
      cwd,
      shell: true,
      stdio: output ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      env,
    };

    const child = spawn(command, args);
    let outputStr = '';

    if (output) {
      child.stdout?.on('data', (data) => {
        outputStr += data;
      });

      child.stderr?.on('data', (data) => {
        outputStr += data;
      });
    }

    child.on('close', (code) => {
      const result = {
        success: code === 0,
        code,
        output: outputStr,
      };

      code === 0
        ? resolve(result)
        : output
          ? reject(new Error(`Error running command: ${command}\n${outputStr}`))
          : reject(new Error(`Error running command: ${command} with code ${code}`));
    });
  });
};
