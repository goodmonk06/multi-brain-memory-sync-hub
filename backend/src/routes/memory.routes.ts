import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const createMemorySchema = z.object({
  key: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
});

const updateMemorySchema = z.object({
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function memoryRoutes(fastify: FastifyInstance) {
  // List all memories
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const memories = await fastify.prisma.memoryItem.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        syncStatuses: {
          include: {
            provider: true,
          },
        },
      },
    });

    return memories.map((memory) => ({
      ...memory,
      tags: JSON.parse(memory.tagsJson),
      syncStatuses: memory.syncStatuses.map((status) => ({
        ...status,
        meta: JSON.parse(status.metaJson),
      })),
    }));
  });

  // Get single memory
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const memory = await fastify.prisma.memoryItem.findUnique({
      where: { id },
      include: {
        syncStatuses: {
          include: {
            provider: true,
          },
        },
      },
    });

    if (!memory) {
      return reply.status(404).send({ error: 'Memory not found' });
    }

    return {
      ...memory,
      tags: JSON.parse(memory.tagsJson),
      syncStatuses: memory.syncStatuses.map((status) => ({
        ...status,
        meta: JSON.parse(status.metaJson),
      })),
    };
  });

  // Create memory
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createMemorySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const { key, content, tags } = result.data;

    // Check if key already exists
    const existing = await fastify.prisma.memoryItem.findUnique({
      where: { key },
    });

    if (existing) {
      return reply.status(409).send({ error: 'Memory with this key already exists' });
    }

    const memory = await fastify.prisma.memoryItem.create({
      data: {
        key,
        content,
        tagsJson: JSON.stringify(tags),
      },
    });

    // Create sync statuses for all enabled providers
    const providers = await fastify.prisma.provider.findMany({
      where: { enabled: true },
    });

    await Promise.all(
      providers.map((provider) =>
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

    return reply.status(201).send({
      ...memory,
      tags: JSON.parse(memory.tagsJson),
    });
  });

  // Update memory
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const result = updateMemorySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const { content, tags } = result.data;

    const memory = await fastify.prisma.memoryItem.findUnique({ where: { id } });
    if (!memory) {
      return reply.status(404).send({ error: 'Memory not found' });
    }

    const updated = await fastify.prisma.memoryItem.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(tags !== undefined && { tagsJson: JSON.stringify(tags) }),
      },
    });

    // Mark all sync statuses as PENDING since memory was updated
    await fastify.prisma.memorySyncStatus.updateMany({
      where: { memoryItemId: id },
      data: { status: 'PENDING' },
    });

    // Trigger sync
    fastify.syncService.triggerSync();

    return {
      ...updated,
      tags: JSON.parse(updated.tagsJson),
    };
  });

  // Delete memory
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const memory = await fastify.prisma.memoryItem.findUnique({ where: { id } });
    if (!memory) {
      return reply.status(404).send({ error: 'Memory not found' });
    }

    await fastify.prisma.memoryItem.delete({ where: { id } });

    return reply.status(204).send();
  });
}
