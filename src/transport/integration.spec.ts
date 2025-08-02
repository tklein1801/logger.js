import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {LogLevel, createLogger} from '../logger';
import {LogEntry, Transport, TransportManager} from '../transport';

// Mock transport for testing
class MockTransport extends Transport {
  public logs: LogEntry[] = [];

  protected sendBatch(logs: LogEntry[]): void {
    this.logs.push(...logs);
  }

  reset() {
    this.logs = [];
  }
}

describe('Logger with Transports Integration', () => {
  let mockTransport: MockTransport;
  let transportManager: TransportManager;

  beforeEach(() => {
    mockTransport = new MockTransport({
      batchSize: 1, // Send immediately for easier testing
      debounceMs: 0,
    });
    transportManager = new TransportManager();
    transportManager.add(mockTransport);
    vi.useFakeTimers();
  });

  afterEach(() => {
    transportManager.destroy();
    vi.useRealTimers();
  });

  it('should send logs to transports', () => {
    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    logger.info('Test message');

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0]).toMatchObject({
      level: LogLevel.INFO,
      message: 'Test message',
      scope: 'TestLogger',
    });
  });

  it('should include metadata in transport logs', () => {
    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    const metadata = {userId: 123, action: 'login'};
    logger.info('User logged in', metadata);

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0].meta).toEqual(metadata);
  });

  it('should respect log levels in transports', () => {
    mockTransport.configure({level: LogLevel.WARN});

    const logger = createLogger({
      scope: 'TestLogger',
      level: LogLevel.DEBUG,
      transports: transportManager,
    });

    logger.debug('Debug message'); // Should not reach transport
    logger.info('Info message'); // Should not reach transport
    logger.warn('Warn message'); // Should reach transport
    logger.error('Error message'); // Should reach transport

    expect(mockTransport.logs).toHaveLength(2);
    expect(mockTransport.logs[0].message).toBe('Warn message');
    expect(mockTransport.logs[1].message).toBe('Error message');
  });

  it('should allow accessing transport manager from logger', () => {
    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    const transports = logger.getTransports();
    expect(transports).toBe(transportManager);
    expect(transports.count).toBe(1);
  });

  it('should allow flushing transports from logger', () => {
    mockTransport.configure({
      batchSize: 10,
      debounceMs: 1000,
    });

    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    logger.info('Message 1');
    logger.info('Message 2');

    // Should not be sent yet
    expect(mockTransport.logs).toHaveLength(0);

    logger.flush();

    // Should be sent now
    expect(mockTransport.logs).toHaveLength(2);
  });

  it('should inherit transports in child loggers', () => {
    const logger = createLogger({
      scope: 'ParentLogger',
      transports: transportManager,
    });

    const childLogger = logger.child({
      scope: 'ChildLogger',
    });

    childLogger.info('Child message');

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0]).toMatchObject({
      level: LogLevel.INFO,
      message: 'Child message',
      scope: 'ChildLogger',
    });
  });

  it('should allow child loggers to override transports', () => {
    const childTransport = new MockTransport({
      batchSize: 1,
      debounceMs: 0,
    });
    const childTransportManager = new TransportManager();
    childTransportManager.add(childTransport);

    const logger = createLogger({
      scope: 'ParentLogger',
      transports: transportManager,
    });

    const childLogger = logger.child({
      scope: 'ChildLogger',
      transports: childTransportManager,
    });

    logger.info('Parent message');
    childLogger.info('Child message');

    // Parent message should go to original transport
    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0].message).toBe('Parent message');

    // Child message should go to child transport
    expect(childTransport.logs).toHaveLength(1);
    expect(childTransport.logs[0].message).toBe('Child message');

    childTransportManager.destroy();
  });

  it('should handle multiple transports', () => {
    const transport2 = new MockTransport({
      batchSize: 1,
      debounceMs: 0,
    });
    transportManager.add(transport2);

    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    logger.info('Test message');

    // Both transports should receive the message
    expect(mockTransport.logs).toHaveLength(1);
    expect(transport2.logs).toHaveLength(1);
    expect(mockTransport.logs[0].message).toBe('Test message');
    expect(transport2.logs[0].message).toBe('Test message');
  });

  it('should format parameters correctly for transports', () => {
    const logger = createLogger({
      scope: 'TestLogger',
      transports: transportManager,
    });

    logger.info('User %s has %d points', 'John', 150);

    expect(mockTransport.logs).toHaveLength(1);
    expect(mockTransport.logs[0].message).toBe('User John has 150 points');
  });
});
