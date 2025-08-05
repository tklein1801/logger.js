import {createLogger, LogLevel} from '../src';

const logger = createLogger({
  label: 'ConsoleLogger',
  transports: [],
  level: LogLevel.INFO,
});

logger.info('This is an info message');

logger.warn('This warns about something and will provide some metadata', {field1: 'value1', field2: 'value2'});
