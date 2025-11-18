import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TemplateService } from '../services/template.service';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string().min(1),
  variables: z.array(z.string()).optional(),
  defaultValues: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  defaultValues: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

const instantiateTemplateSchema = z.object({
  key: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
});

export async function templateRoutes(fastify: FastifyInstance) {
  const templateService = new TemplateService(fastify.prisma);

  // List templates
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { category, isPublic, search } = request.query as any;

    const templates = await templateService.listTemplates({
      category,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      search,
    });

    return templates;
  });

  // Get template
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return templateService.getTemplate(id);
  });

  // Create template
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createTemplateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const template = await templateService.createTemplate(result.data);
    return reply.status(201).send(template);
  });

  // Update template
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const result = updateTemplateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const template = await templateService.updateTemplate(id, result.data);
    return template;
  });

  // Delete template
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await templateService.deleteTemplate(id);
    return reply.status(204).send();
  });

  // Instantiate template
  fastify.post('/:id/instantiate', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const result = instantiateTemplateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error });
    }

    const memory = await templateService.instantiateTemplate(id, result.data);
    return reply.status(201).send(memory);
  });
}
