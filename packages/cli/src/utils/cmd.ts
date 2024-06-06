import { spawn } from 'child_process';
import commandExists from 'command-exists';
import * as pty from 'node-pty';
import { logger } from '../logger';

export type SpawnPromiseResult = {
  success: boolean;
  code: number | null;
  output: string;
};

export class CommandError extends Error {
  constructor(
    message: string,
    public code: number | null,
    public output: string,
  ) {
    super(message);
  }
}

export async function isInstalled(command: string): Promise<boolean> {
  try {
    await commandExists(command);
    return true;
  } catch (error) {
    return false;
  }
}

async function getTerminalExecutable(command: string): Promise<{ shell: string; args: string[]; exec: string }> {
  if (process.platform === 'win32') {
    return { shell: 'powershell.exe', args: [], exec: `${command}; exit\r` };
  } else if (process.platform === 'darwin' && (await isInstalled('zsh'))) {
    return {
      shell: 'zsh',
      args: ['--no-rcs', '-d'],
      exec: `unsetopt share_history; unsetopt inc_append_history; ${command}; exit\r`,
    };
  }

  return { shell: 'bash', args: ['--norc', '--noprofile'], exec: `${command}; exit\r` };
}

export async function spawnPromise(
  command: string,
  options?: {
    cwd?: string;
    envVars?: Record<string, string | undefined>;
    captureOutput?: boolean;
    output?: boolean;
  },
): Promise<SpawnPromiseResult> {
  const { shell, args, exec } = await getTerminalExecutable(command);
  return new Promise((resolve, reject) => {
    logger.debug(`Running command: ${command}`);
    const opts = {
      ...(options || {}),
      cwd: options?.cwd || process.cwd(),
      envVars: options?.envVars || {},
      captureOutput: options?.captureOutput || false,
      output: options?.output || true,
    };

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(opts.envVars || {}),
      ...(opts.output ? { FORCE_COLOR: '1' } : {}),
    };

    let outputStr = '';
    if (opts.captureOutput) {
      const child = spawn(command, {
        cwd: opts.cwd,
        env,
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (data) => {
        outputStr += data;
        logger.debug(data.toString());
      });

      child.stderr.on('data', (data) => {
        outputStr += data;
        logger.debug(data.toString());
      });

      child.on('exit', (code) => {
        const result = {
          success: code === 0,
          code,
          output: outputStr,
        };
        result.success
          ? resolve(result)
          : reject(new CommandError(`Error running command: ${command}`, code, outputStr));
      });
    } else {
      const term = pty.spawn(shell, args, {
        name: 'xterm-color',
        cwd: opts.cwd,
        env,
        encoding: null,
      });

      term.onData((data) => {
        if (opts.output) process.stdout.write(data);
        if (opts.captureOutput) outputStr += data;
        logger.debug(data.toString());
      });

      term.onExit(({ exitCode }) => {
        const result = {
          success: exitCode === 0,
          code: exitCode,
          output: outputStr,
        };
        result.success
          ? resolve(result)
          : reject(new CommandError(`Error running command: ${command}`, exitCode, outputStr));
      });

      term.write(exec);
    }
  });
}
