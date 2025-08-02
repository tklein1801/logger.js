# Transport System Examples

Das Transport-System ermöglicht es, Logs zu verschiedenen Zielen zu senden, ähnlich wie bei Winston Transports.

## Grundlegendes Beispiel

```typescript
import {ConsoleTransport, HttpTransport, TransportManager, createLogger} from '@tklein1801/logger.js';

// Transport Manager erstellen
const transportManager = new TransportManager();

// Console Transport hinzufügen
const consoleTransport = new ConsoleTransport({
  batchSize: 5,
  debounceMs: 1000,
  level: LogLevel.DEBUG,
});
transportManager.add(consoleTransport);

// HTTP Transport hinzufügen
const httpTransport = new HttpTransport('https://api.example.com/logs', {
  batchSize: 10,
  debounceMs: 2000,
  level: LogLevel.INFO,
  headers: {
    Authorization: 'Bearer your-token',
  },
});
transportManager.add(httpTransport);

// Logger mit Transporten erstellen
const logger = createLogger({
  scope: 'MyApp',
  transports: transportManager,
});

// Logs werden automatisch an alle Transporte gesendet
logger.info('Application started');
logger.error('Something went wrong', {userId: 123, action: 'login'});

// Alle gepufferten Logs sofort senden
logger.flush();
```

## Custom Transport erstellen

```typescript
import {LogEntry, Transport, TransportOptions} from '@tklein1801/logger.js';

class DatabaseTransport extends Transport {
  private db: Database;

  constructor(database: Database, options: TransportOptions = {}) {
    super(options);
    this.db = database;
  }

  protected async sendBatch(logs: LogEntry[]): Promise<void> {
    const records = logs.map(log => ({
      level: log.level,
      message: log.message,
      scope: log.scope,
      timestamp: log.timestamp,
      metadata: JSON.stringify(log.meta || {}),
    }));

    await this.db.table('logs').insert(records);
  }
}

// Verwendung
const dbTransport = new DatabaseTransport(myDatabase, {
  batchSize: 20,
  debounceMs: 5000,
  level: LogLevel.WARN,
});

transportManager.add(dbTransport);
```

## Transport-Konfiguration

### Batch-Verarbeitung

```typescript
const transport = new ConsoleTransport({
  batchSize: 50, // Logs in 50er-Batches senden
  debounceMs: 3000, // 3 Sekunden warten bevor Batch gesendet wird
});
```

### Log-Level-Filterung

```typescript
const errorTransport = new HttpTransport('https://errors.example.com', {
  level: LogLevel.ERROR, // Nur ERROR und FATAL Logs
});

const debugTransport = new FileTransport('./debug.log', {
  level: LogLevel.DEBUG, // Alle Logs außer SILENT
});
```

### Transport-Management

```typescript
// Transport aktivieren/deaktivieren
transport.enable();
transport.disable();

// Transport-Konfiguration zur Laufzeit ändern
transport.configure({
  batchSize: 25,
  debounceMs: 1500,
});

// Transport ordnungsgemäß beenden
transport.destroy();
```

## File Transport Beispiel

```typescript
import {FileTransport} from '@tklein1801/logger.js';

const fileTransport = new FileTransport('./app.log', {
  batchSize: 100,
  debounceMs: 5000,
  level: LogLevel.INFO,
});

transportManager.add(fileTransport);
```

## Erweiterte Verwendung

### Verschiedene Transporte für verschiedene Log-Level

```typescript
// Alle Logs in Datei
const allLogsTransport = new FileTransport('./all.log', {
  level: LogLevel.DEBUG,
  batchSize: 50,
});

// Nur Errors per HTTP
const errorTransport = new HttpTransport('https://errors.api.com/logs', {
  level: LogLevel.ERROR,
  batchSize: 1, // Sofort senden
  debounceMs: 0,
});

// Nur Performance-Logs in separate Datei
const performanceTransport = new FileTransport('./performance.log', {
  level: LogLevel.INFO,
  batchSize: 10,
});

transportManager.add(allLogsTransport);
transportManager.add(errorTransport);
transportManager.add(performanceTransport);
```

### Child Logger mit eigenen Transporten

```typescript
const mainLogger = createLogger({
  scope: 'MainApp',
  transports: mainTransportManager,
});

// Child Logger mit zusätzlichen Transporten
const auditTransportManager = new TransportManager();
auditTransportManager.add(new HttpTransport('https://audit.api.com/logs'));

const auditLogger = mainLogger.child({
  scope: 'AuditService',
  transports: auditTransportManager,
});

auditLogger.info('User action logged'); // Geht nur zu Audit-Service
```

## Best Practices

1. **Batch-Größe optimieren**: Große Batches sind effizienter, aber erhöhen die Latenz
2. **Debounce-Zeit anpassen**: Kürzere Zeiten für kritische Logs, längere für Debug-Logs
3. **Log-Level pro Transport**: Verschiedene Ziele für verschiedene Schweregrade
4. **Error Handling**: Transporte sollten nicht die Anwendung zum Absturz bringen
5. **Resource Cleanup**: `destroy()` aufrufen beim Beenden der Anwendung

```typescript
// Graceful shutdown
process.on('SIGTERM', () => {
  logger.flush(); // Alle gepufferten Logs senden
  transportManager.destroy(); // Cleanup
  process.exit(0);
});
```
