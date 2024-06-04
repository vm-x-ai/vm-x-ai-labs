import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: false,
      ignore: 'pid,hostname,time,level',
    },
  },
  level: 'info',
});
