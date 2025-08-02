import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {LogLevel} from '../logger';
import {LogEntry, Transport, TransportOptions} from './transport';

// Mock transport implementation for testing
class TestTransport extends Transport {
  public sentBatches: LogEntry[][] = [];
  public sendError: Error | null = null;

  protected sendBatch(logs: LogEntry[]): void {
    if (this.sendError) {
      throw this.sendError;
    }
    this.sentBatches.push([...logs]);
  }

  reset() {
    this.sentBatches = [];
    this.sendError = null;
  }
}

describe('Transport', () => {
  let transport: TestTransport;

  beforeEach(() => {
    transport = new TestTransport();
    vi.useFakeTimers();
  });

  afterEach(() => {
    transport.destroy();
    vi.useRealTimers();
  });

  describe('configuration', () => {
    it('should use default options when none provided', () => {
      const defaultTransport = new TestTransport();
      expect(defaultTransport['options'].batchSize).toBe(10);
      expect(defaultTransport['options'].debounceMs).toBe(1000);
      expect(defaultTransport['options'].level).toBe(LogLevel.INFO);
      expect(defaultTransport['options'].enabled).toBe(true);
    });

    it('should use custom options when provided', () => {
      const options: TransportOptions = {
        batchSize: 5,
        debounceMs: 500,
        level: LogLevel.ERROR,
        enabled: false,
      };
      const customTransport = new TestTransport(options);

      expect(customTransport['options'].batchSize).toBe(5);
      expect(customTransport['options'].debounceMs).toBe(500);
      expect(customTransport['options'].level).toBe(LogLevel.ERROR);
      expect(customTransport['options'].enabled).toBe(false);
    });

    it('should ensure positive batch size', () => {
      const negativeTransport = new TestTransport({batchSize: -5});
      expect(negativeTransport['options'].batchSize).toBe(1);

      const zeroTransport = new TestTransport({batchSize: 0});
      expect(zeroTransport['options'].batchSize).toBe(1);
    });

    it('should ensure non-negative debounce time', () => {
      const negativeTransport = new TestTransport({debounceMs: -100});
      expect(negativeTransport['options'].debounceMs).toBe(0);
    });
  });

  describe('log filtering', () => {
    it('should not log when transport is disabled', () => {
      transport.configure({enabled: false});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      transport.flush();

      expect(transport.sentBatches).toHaveLength(0);
    });

    it('should filter logs by level', () => {
      transport.configure({level: LogLevel.WARN});

      const debugLog: LogEntry = {
        level: LogLevel.DEBUG,
        message: 'Debug message',
        scope: 'test',
        timestamp: new Date(),
      };

      const errorLog: LogEntry = {
        level: LogLevel.ERROR,
        message: 'Error message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(debugLog);
      transport.log(errorLog);
      transport.flush();

      expect(transport.sentBatches).toHaveLength(1);
      expect(transport.sentBatches[0]).toHaveLength(1);
      expect(transport.sentBatches[0][0].message).toBe('Error message');
    });
  });

  describe('batching', () => {
    it('should send logs immediately when batch size is reached', () => {
      transport.configure({batchSize: 2, debounceMs: 1000});

      const log1: LogEntry = {
        level: LogLevel.INFO,
        message: 'Message 1',
        scope: 'test',
        timestamp: new Date(),
      };

      const log2: LogEntry = {
        level: LogLevel.INFO,
        message: 'Message 2',
        scope: 'test',
        timestamp: new Date(),
      };

      const log3: LogEntry = {
        level: LogLevel.INFO,
        message: 'Message 3',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(log1);
      expect(transport.sentBatches).toHaveLength(0);

      transport.log(log2);
      expect(transport.sentBatches).toHaveLength(1);
      expect(transport.sentBatches[0]).toHaveLength(2);

      transport.log(log3);
      expect(transport.sentBatches).toHaveLength(1);

      // Should not have sent the third log yet
      vi.advanceTimersByTime(1000);
      expect(transport.sentBatches).toHaveLength(2);
      expect(transport.sentBatches[1]).toHaveLength(1);
    });
  });

  describe('debouncing', () => {
    it('should debounce log sending', () => {
      transport.configure({batchSize: 10, debounceMs: 500});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      expect(transport.sentBatches).toHaveLength(0);

      // Before debounce time
      vi.advanceTimersByTime(400);
      expect(transport.sentBatches).toHaveLength(0);

      // After debounce time
      vi.advanceTimersByTime(200);
      expect(transport.sentBatches).toHaveLength(1);
    });

    it('should reset debounce timer on new logs', () => {
      transport.configure({batchSize: 10, debounceMs: 500});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      vi.advanceTimersByTime(400);

      // Add another log, should reset timer
      transport.log(logEntry);
      vi.advanceTimersByTime(400);
      expect(transport.sentBatches).toHaveLength(0);

      vi.advanceTimersByTime(200);
      expect(transport.sentBatches).toHaveLength(1);
      expect(transport.sentBatches[0]).toHaveLength(2);
    });
  });

  describe('flush', () => {
    it('should immediately send all buffered logs', () => {
      transport.configure({batchSize: 10, debounceMs: 1000});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      transport.log(logEntry);
      expect(transport.sentBatches).toHaveLength(0);

      transport.flush();
      expect(transport.sentBatches).toHaveLength(1);
      expect(transport.sentBatches[0]).toHaveLength(2);
    });

    it('should cancel pending debounce timer', () => {
      transport.configure({batchSize: 10, debounceMs: 1000});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      transport.flush();

      // Timer should be cancelled, no additional sends
      vi.advanceTimersByTime(1000);
      expect(transport.sentBatches).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle transport errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      transport.sendError = new Error('Transport failed');

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      expect(() => transport.log(logEntry)).not.toThrow();
      transport.flush();

      expect(consoleSpy).toHaveBeenCalledWith('Transport failed to send batch:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('lifecycle', () => {
    it('should clean up on destroy', () => {
      transport.configure({debounceMs: 1000});

      const logEntry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        scope: 'test',
        timestamp: new Date(),
      };

      transport.log(logEntry);
      transport.destroy();

      expect(transport.sentBatches).toHaveLength(1);
    });
  });
});
