import {LogLevel, type LogMeta} from '../../LogClient';

/**
 * Prints a log message to the console.
 * @param level The log level of the message.
 * @param formattedMessage The formatted log message.
 * @param meta Optional metadata associated with the log message.
 * @param hideMeta Optional flag to hide metadata in the output.
 */
export function printMessage(level: LogLevel, formattedMessage: string, meta?: LogMeta, hideMeta?: boolean) {
  switch (level) {
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      meta && !hideMeta ? console.error(formattedMessage, meta) : console.error(formattedMessage);
      break;
    case LogLevel.WARN:
      meta && !hideMeta ? console.warn(formattedMessage, meta) : console.warn(formattedMessage);
      break;
    // For readability, we can keep INFO and DEBUG
    // case LogLevel.INFO:
    // case LogLevel.DEBUG:
    default:
      meta && !hideMeta ? console.log(formattedMessage, meta) : console.log(formattedMessage);
  }
}
