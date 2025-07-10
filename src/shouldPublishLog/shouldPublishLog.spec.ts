import {describe, expect, test} from 'vitest';

import {LogLevel} from '../logger';
import {shouldPublishLog} from './shouldPublishLog';

const allLogLevels = [LogLevel.SILENT, LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];

describe('shouldLog (matrix)', () => {
  test('it validates all combinations of currentLevel and logLevel', () => {
    allLogLevels.forEach(currentLevel => {
      allLogLevels.forEach(logLevel => {
        const result = shouldPublishLog(currentLevel, logLevel);

        const expected = currentLevel === LogLevel.SILENT ? false : logLevel <= currentLevel;

        if (result !== expected) {
          // Should throw an error if the result does not match the expected value
          throw new Error(
            `shouldPublishLog(${LogLevel[currentLevel]}, ${LogLevel[logLevel]}) should be ${expected} but got ${result}`,
          );
        }
        expect(result).toBe(expected);
      });
    });
  });
});
