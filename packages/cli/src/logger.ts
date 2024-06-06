import fs from 'fs';
import os from 'os';
import path from 'path';
import pino from 'pino';
import pretty from 'pino-pretty';

export const logDir = path.join(os.homedir(), '.vm-x-ai', 'logs');
export const debugLogFile = path.join(
  logDir,
  `debug_${new Date().toISOString().replace(/-/g, '_').replace('T', '_').replace(/:/g, '_').replace('.', '_')}.log`,
);
fs.mkdirSync(logDir, { recursive: true });

const debugFileStream = pretty({
  colorize: false,
  ignore: 'pid,hostname',
  destination: fs.createWriteStream(debugLogFile),
});

const stream = pretty({
  colorize: false,
  ignore: 'pid,hostname,time,level',
});

export const logger = pino(
  {
    level: 'debug',
  },
  getDefaultLoggerStream('info'),
);

function getDefaultLoggerStream(level: pino.Level) {
  return pino.multistream([
    {
      level,
      stream,
    },
    {
      level: 'debug',
      stream: debugFileStream,
    },
  ]);
}

export const setGlobalLevel = (level: pino.Level) => {
  (
    logger as pino.Logger & {
      [pino.symbols.streamSym]: pino.DestinationStream;
    }
  )[pino.symbols.streamSym] = getDefaultLoggerStream(level);
};
