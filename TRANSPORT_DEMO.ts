import {ConsoleTransport, HttpTransport, LogLevel, TransportManager, createLogger} from './src';

// Transport Manager erstellen
const transportManager = new TransportManager();

// Console Transport mit Batching und Debouncing
const consoleTransport = new ConsoleTransport({
  batchSize: 5, // 5 Logs pro Batch
  debounceMs: 1000, // 1 Sekunde warten
  level: LogLevel.DEBUG,
});

// HTTP Transport für kritische Logs
const httpTransport = new HttpTransport('https://api.example.com/logs', {
  batchSize: 1, // Sofort senden
  debounceMs: 0, // Kein Debouncing
  level: LogLevel.ERROR,
  headers: {
    Authorization: 'Bearer your-token',
  },
});

// Transporte hinzufügen
transportManager.add(consoleTransport);
transportManager.add(httpTransport);

// Logger erstellen
const logger = createLogger({
  scope: 'DemoApp',
  transports: transportManager,
});

// Beispiel-Verwendung
logger.info('Application started');
logger.debug('Debug information');
logger.error('Something went wrong', {userId: 123, action: 'login'});

// Batch-Verhalten demonstrieren
console.log('Sending 3 info logs (batch size is 5, so they will be debounced)...');
logger.info('Log 1');
logger.info('Log 2');
logger.info('Log 3');

// Nach 1 Sekunde werden die Logs gesendet
setTimeout(() => {
  console.log('Adding 2 more logs to complete the batch...');
  logger.info('Log 4');
  logger.info('Log 5'); // Batch wird sofort gesendet
}, 500);

// Alle gepufferten Logs sofort senden
setTimeout(() => {
  logger.flush();
}, 2000);
