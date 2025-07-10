import {LogLevel} from '../logger';

/**
 * Determines whether a log message should be output based on the current logging level.
 *
 * @param {LogLevel} currentLevel - The current minimum log level. Messages below this level will not be logged.
 * @param {LogLevel} logLevel - The log level of the message to evaluate.
 * @returns {boolean} Returns `true` if the message should be logged, or `false` otherwise.
 *
 * If `currentLevel` is `LogLevel.SILENT`, no messages are logged.
 * Otherwise, messages with a level less than or equal to `currentLevel` will be logged.
 *
 * @example
 * shouldPublishLog(LogLevel.INFO, LogLevel.ERROR); // true
 * shouldPublishLog(LogLevel.WARN, LogLevel.INFO);  // false
 * shouldPublishLog(LogLevel.SILENT, LogLevel.DEBUG); // false
 */
export function shouldPublishLog(currentLevel: LogLevel, logLevel: LogLevel): boolean {
  if (currentLevel === LogLevel.SILENT) return false;
  return logLevel <= currentLevel;
}
