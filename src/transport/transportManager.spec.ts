import {describe, expect, it} from 'vitest';

import {LogLevel} from '../logger';
import {LogEntry, Transport} from './transport';
import {TransportManager} from './transportManager';

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

describe('TransportManager', () => {
  it('should add and manage multiple transports', () => {
    const manager = new TransportManager();
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    expect(manager.count).toBe(0);

    manager.add(transport1);
    expect(manager.count).toBe(1);

    manager.add(transport2);
    expect(manager.count).toBe(2);

    expect(manager.all).toEqual([transport1, transport2]);
  });

  it('should remove transports correctly', () => {
    const manager = new TransportManager();
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    manager.add(transport1);
    manager.add(transport2);

    manager.remove(transport1);
    expect(manager.count).toBe(1);
    expect(manager.all).toEqual([transport2]);
  });

  it('should send logs to all transports', () => {
    const manager = new TransportManager();
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    manager.add(transport1);
    manager.add(transport2);

    const logEntry: LogEntry = {
      level: LogLevel.INFO,
      message: 'Test message',
      scope: 'test',
      timestamp: new Date(),
    };

    manager.log(logEntry);

    // Both transports should receive the log
    // Note: They will be in buffer until flushed
    manager.flush();

    expect(transport1.logs).toHaveLength(1);
    expect(transport2.logs).toHaveLength(1);
    expect(transport1.logs[0]).toEqual(logEntry);
    expect(transport2.logs[0]).toEqual(logEntry);
  });

  it('should flush all transports', () => {
    const manager = new TransportManager();
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    manager.add(transport1);
    manager.add(transport2);

    const logEntry: LogEntry = {
      level: LogLevel.INFO,
      message: 'Test message',
      scope: 'test',
      timestamp: new Date(),
    };

    manager.log(logEntry);
    manager.flush();

    expect(transport1.logs).toHaveLength(1);
    expect(transport2.logs).toHaveLength(1);
  });

  it('should destroy all transports', () => {
    const manager = new TransportManager();
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    manager.add(transport1);
    manager.add(transport2);

    const logEntry: LogEntry = {
      level: LogLevel.INFO,
      message: 'Test message',
      scope: 'test',
      timestamp: new Date(),
    };

    manager.log(logEntry);
    manager.destroy();

    // Should have flushed before destroying
    expect(transport1.logs).toHaveLength(1);
    expect(transport2.logs).toHaveLength(1);
    expect(manager.count).toBe(0);
  });

  it('should return immutable array of transports', () => {
    const manager = new TransportManager();
    const transport = new MockTransport();

    manager.add(transport);
    const transports = manager.all;

    expect(transports).toHaveLength(1);

    // Modifying the returned array should not affect the manager
    (transports as any[]).push(new MockTransport());
    expect(manager.count).toBe(1);
  });
});
