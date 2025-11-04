import {ConsoleTransport, LogClient, LogLevel} from '../src';

const logger = LogClient.fromConfig({
  label: 'ConsoleLogger',
  transports: [],
  level: LogLevel.INFO,
  hideMeta: true,
});

logger.info('This is an info message');

logger.warn('This warns about something and will provide some metadata', {field1: 'value1', field2: 'value2'});

const childLogger = LogClient.fromParent(logger, {
  label: 'ChildLogger',
  transports: [
    new ConsoleTransport({
      label: 'ChildLogger',
      format(_dateTime, _level, label, message, _meta) {
        return `[CUSTOM] ${label}: ${message}`;
      },
    }),
  ],
});

childLogger.info('This is an info message from the child logger', {meta: 'data'});
