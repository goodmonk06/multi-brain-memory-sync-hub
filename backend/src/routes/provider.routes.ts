import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'OTHER']),
  config: z.record(z.any()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
});

export async function providerRoutes(fastify: FastifyInstance) {
  // List all providers
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const providers = await fastify.prisma.provider.findMany({
      orderBy: { name: 'asc' },
      include: {
        syncStatuses: {
          select: {
            status: true,
          },
        },
      },
    });

    return providers.map((provider) => ({
      ...provider,
      config: JSON.parse(provider.configJson),
      stats: {
        total: provider.syncStatuses.length,
        pending: provider.syncStatuses.filter((s) => s.status === 'PENDING').length,
        syncing: provider.syncStatuses.filter((s) => s.status === 'SYNCING').length,
        success: provider.syncStatuses.filter((s) => s.status === 'SUCCESS').length,
        failed: provider.syncStatuses.filter((s) => s.status === 'FAILED').length,
      },
      syncStatuses: undefined,
    }));
  });

  // Get single provider
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const provider = await fastify.prisma.provider.findUnique({
      where: { id },
      include: {
        syncStatuses: {
          include: {
            memoryItem: true,
          },
        },
      },
    });

    if (!provider) {
      return reply.status(404).send({ error: 'Provider not found' });
    }

    return {
      ...provider,
      config: JSON.parse(provider.configJson),
      syncStatuses: provider.syncStatuses.map((status) => ({
        ...status,
        meta: JSON.parse(status.metaJson),
        memoryItem: {
          ...status.memoryItem,
          tags: JSON.parse(status.memoryItem.tagsJson),
        },
      })),
    };
  });

  // Create provider
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createProviderSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const { name, type, config, enabled } = result.data;

    // Check if provider with this name already exists
    const existing = await fastify.prisma.provider.findUnique({
      where: { name },
    });

    if (existing) {
      return reply.status(409).send({ error: 'Provider with this name already exists' });
    }

    const provider = await fastify.prisma.provider.create({
      data: {
        name,
        type,
        configJson: JSON.stringify(config),
        enabled,
      },
    });

    // Create sync statuses for all existing memory items if provider is enabled
    if (enabled) {
      const memoryItems = await fastify.prisma.memoryItem.findMany();

      await Promise.all(
        memoryItems.map((memory) =>
          fastify.prisma.memorySyncStatus.create({
            data: {
              memoryItemId: memory.id,
              providerId: provider.id,
              status: 'PENDING',
            },
          })
        )
      );

      // Trigger sync
      fastify.syncService.triggerSync();
    }

    return reply.status(201).send({
      ...provider,
      config: JSON.parse(provider.configJson),
    });
  });

  // Update provider
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const result = updateProviderSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const { name, config, enabled } = result.data;

    const provider = await fastify.prisma.provider.findUnique({ where: { id } });
    if (!provider) {
      return reply.status(404).send({ error: 'Provider not found' });
    }

    const wasDisabled = !provider.enabled;

    const updated = await fastify.prisma.provider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(config !== undefined && { configJson: JSON.stringify(config) }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    // If provider was just enabled, create sync statuses for all existing memory items
    if (wasDisabled && enabled) {
      const memoryItems = await fastify.prisma.memoryItem.findMany();

      await Promise.all(
        memoryItems.map((memory) =>
          fastify.prisma.memorySyncStatus.upsert({
            where: {
              memoryItemId_providerId: {
                memoryItemId: memory.id,
                providerId: id,
              },
            },
            create: {
              memoryItemId: memory.id,
              providerId: id,
              status: 'PENDING',
            },
            update: {
              status: 'PENDING',
            },
          })
        )
      );

      // Trigger sync
      fastify.syncService.triggerSync();
    }

    return {
      ...updated,
      config: JSON.parse(updated.configJson),
    };
  });

  // Delete provider
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const provider = await fastify.prisma.provider.findUnique({ where: { id } });
    if (!provider) {
      return reply.status(404).send({ error: 'Provider not found' });
    }

    await fastify.prisma.provider.delete({ where: { id } });

    return reply.status(204).send();
  });
}
