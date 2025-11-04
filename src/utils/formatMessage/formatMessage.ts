import {LOG_COLORS, LOG_LEVEL_COLORS} from '../../colors';
import {LogLevel, type LogLevelStrings} from '../../LogClient';

/**
 * Pads the log level string to a fixed length for consistent formatting.
 * @param level The log level to pad.
 * @returns The padded log level string.
 */
function getPaddedLevel(level: LogLevel) {
  const LEVEL_STRINGS = Object.values(LogLevel)
    .filter(level => typeof level === 'string')
    .map(level => level.toLowerCase()) as Lowercase<LogLevelStrings>[];
  const MAX_LEVEL_LENGTH = Math.max(...LEVEL_STRINGS.map(l => l.length));
  return LogLevel[level].padEnd(MAX_LEVEL_LENGTH, ' ');
}

/**
 * Formats a log message with the given level, message, and scope.
 * @param dateTime The date and time of the log entry.
 * @param level The log level.
 * @param message The log message.
 * @param label The log label.
 * @returns The formatted log message.
 */
export function formatMessage(dateTime: Date, level: LogLevel, message: string, label: string): string {
  const timestamp = dateTime.toISOString();
  const levelString = getPaddedLevel(level);
  return `${LOG_COLORS.dim}${timestamp}${LOG_COLORS.reset} ${LOG_LEVEL_COLORS[level]}${levelString}${LOG_COLORS.reset} ${LOG_COLORS.bright}[${label}]:${LOG_COLORS.reset} ${message}`;
}
