import { createServer } from 'http';
import { validateEnv, env } from './config/env.js';
import { logger } from './config/logger.js';
import { startWorkers, stopWorkers } from './jobs/index.js';
import { createApp } from './app.js';
import { disconnectAll } from './core/tenant-prisma.js';
import { getCentralPrisma } from './core/tenant-registry.js';
import { attachLiveTranscriptWs } from './modules/consultations/live-transcript.ws.js';

async function bootstrap(): Promise<void> {
  validateEnv();
  logger.info({ nodeEnv: env.NODE_ENV, port: env.PORT }, 'Starting CareMind AI backend');

  await startWorkers();

  const app = createApp();
  const server = createServer(app);
  attachLiveTranscriptWs(server);

  server.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });

  async function gracefulShutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      try {
        await stopWorkers();
        await getCentralPrisma().$disconnect();
        await disconnectAll();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
