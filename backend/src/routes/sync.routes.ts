import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function syncRoutes(fastify: FastifyInstance) {
  // Get sync overview
  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const statuses = await fastify.prisma.memorySyncStatus.findMany({
      include: {
        memoryItem: true,
        provider: true,
      },
    });

    const overview = {
      total: statuses.length,
      byStatus: {
        pending: statuses.filter((s) => s.status === 'PENDING').length,
        syncing: statuses.filter((s) => s.status === 'SYNCING').length,
        success: statuses.filter((s) => s.status === 'SUCCESS').length,
        failed: statuses.filter((s) => s.status === 'FAILED').length,
      },
      byProvider: {} as Record<string, any>,
    };

    // Group by provider
    statuses.forEach((status) => {
      if (!overview.byProvider[status.provider.name]) {
        overview.byProvider[status.provider.name] = {
          total: 0,
          pending: 0,
          syncing: 0,
          success: 0,
          failed: 0,
        };
      }
      overview.byProvider[status.provider.name].total++;
      overview.byProvider[status.provider.name][status.status.toLowerCase()]++;
    });

    return overview;
  });

  // Manually trigger sync
  fastify.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    fastify.syncService.triggerSync();
    return { message: 'Sync triggered' };
  });

  // Retry failed syncs
  fastify.post('/retry-failed', async (request: FastifyRequest, reply: FastifyReply) => {
    const failedStatuses = await fastify.prisma.memorySyncStatus.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING' },
    });

    fastify.syncService.triggerSync();

    return {
      message: 'Failed syncs marked for retry',
      count: failedStatuses.count,
    };
  });

  // Get detailed sync status
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const statuses = await fastify.prisma.memorySyncStatus.findMany({
      include: {
        memoryItem: true,
        provider: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return statuses.map((status) => ({
      id: status.id,
      status: status.status,
      lastSyncedAt: status.lastSyncedAt,
      updatedAt: status.updatedAt,
      meta: JSON.parse(status.metaJson),
      memoryItem: {
        id: status.memoryItem.id,
        key: status.memoryItem.key,
        content: status.memoryItem.content,
        tags: JSON.parse(status.memoryItem.tagsJson),
      },
      provider: {
        id: status.provider.id,
        name: status.provider.name,
        type: status.provider.type,
      },
    }));
  });
}
