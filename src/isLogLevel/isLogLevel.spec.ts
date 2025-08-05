import {describe, expect, test} from 'vitest';
import {isLogLevel} from './isLogLevel';

describe('isLogLevel', () => {
  test('it returns true for valid log level strings (case-insensitive)', () => {
    expect(isLogLevel('ERROR')).toBe(true);
    expect(isLogLevel('error')).toBe(true);
    expect(isLogLevel('Warn')).toBe(true);
    expect(isLogLevel('INFO')).toBe(true);
    expect(isLogLevel('debug')).toBe(true);
    expect(isLogLevel('SILENT')).toBe(true);
  });

  test('it returns false for invalid log level strings', () => {
    expect(isLogLevel('TRACE')).toBe(false);
    expect(isLogLevel('VERBOSE')).toBe(false);
    expect(isLogLevel('')).toBe(false);
    expect(isLogLevel('err')).toBe(false);
    expect(isLogLevel('warnning')).toBe(false);
    expect(isLogLevel('123')).toBe(false);
    expect(isLogLevel('INFOO')).toBe(false);
  });
});
