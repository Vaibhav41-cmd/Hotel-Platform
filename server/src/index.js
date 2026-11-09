import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createProductionStore } from './store.js';
import { initializeJobs } from './jobs.js';
import { logEvent } from './http.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in production.');
}
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production; the in-memory demo store is development-only.');
}

const store = await createProductionStore();
const pruneRefreshTokens = () => store.deleteExpiredRefreshTokens().catch((error) => {
  console.error(JSON.stringify({ level: 'error', event: 'auth.refresh_token_cleanup_failed', message: error.message }));
});
void pruneRefreshTokens();
const refreshTokenCleanup = setInterval(pruneRefreshTokens, 6 * 60 * 60 * 1000);
refreshTokenCleanup.unref();
let jobs;
try {
  jobs = await initializeJobs();
} catch (error) {
  console.error(JSON.stringify({ level: 'error', event: 'jobs.start_failed', message: error.message }));
  jobs = { enqueue: async () => {}, close: async () => {} };
}
const app = createApp({ store, enqueueNotification: jobs.enqueue });
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, '0.0.0.0', () => {
  logEvent('api.started', { port, mode: store.mode });
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logEvent('api.shutdown', { signal });
  clearInterval(refreshTokenCleanup);
  server.close(async () => {
    await jobs.close();
    if (store.prisma) await store.prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
