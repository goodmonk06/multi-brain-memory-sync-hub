import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { memoryRoutes } from './routes/memory.routes';
import { providerRoutes } from './routes/provider.routes';
import { syncRoutes } from './routes/sync.routes';
import { templateRoutes } from './routes/template.routes';
import { SyncService } from './services/sync.service';
import { logger } from './lib/logger';
import { errorHandler } from './lib/errors';
import { metrics } from './lib/metrics';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
const syncService = new SyncService(prisma);

const fastify = Fastify({
  logger,
  disableRequestLogging: false,
  requestIdLogLabel: 'reqId',
});

// Register error handler
fastify.setErrorHandler(errorHandler);

// Register plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

// Decorate fastify with prisma and syncService
fastify.decorate('prisma', prisma);
fastify.decorate('syncService', syncService);

// Register routes
fastify.register(memoryRoutes, { prefix: '/api/memories' });
fastify.register(providerRoutes, { prefix: '/api/providers' });
fastify.register(syncRoutes, { prefix: '/api/sync' });
fastify.register(templateRoutes, { prefix: '/api/templates' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Metrics endpoint
fastify.get('/metrics', async () => {
  return metrics.getAllMetrics();
});

// Graceful shutdown
const closeGracefully = async (signal: string) => {
  fastify.log.info(`Received ${signal}, closing gracefully`);
  await prisma.$disconnect();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);

    // Start background sync job
    syncService.startBackgroundSync();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Type declarations for decorated properties
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    syncService: SyncService;
  }
}
