import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDatabase } from './db.js';
import { loadConfig, LIMITS } from './config.js';
import { createApp, cleanup } from './app.js';

const config = loadConfig();
if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });
const db = openDatabase(config.dbPath);
const server = createServer(createApp({ db, config }));

const sweep = () => {
  try {
    cleanup(db, Date.now());
  } catch (err) {
    console.error('Ошибка очистки:', err?.message);
  }
};
sweep();
const timer = setInterval(sweep, LIMITS.cleanupInterval);

server.listen(config.port, () => {
  console.log(`Сервер групп Компаса слушает порт ${config.port}`);
});

const shutdown = () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
