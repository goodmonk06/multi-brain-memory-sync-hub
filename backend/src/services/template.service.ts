import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';
import { NotFoundError, ValidationError } from '../lib/errors';
import { eventBus, createEvent, DomainEventType } from '../lib/events';

export class TemplateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new memory template
   */
  async createTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    content: string;
    variables?: string[];
    defaultValues?: Record<string, any>;
    tags?: string[];
    isPublic?: boolean;
  }) {
    logger.info({ templateName: data.name }, 'Creating memory template');

    const template = await this.prisma.memoryTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        content: data.content,
        variables: JSON.stringify(data.variables || []),
        defaultValues: JSON.stringify(data.defaultValues || {}),
        tags: JSON.stringify(data.tags || []),
        isPublic: data.isPublic ?? false,
      },
    });

    await eventBus.emit(
      createEvent(DomainEventType.TEMPLATE_CREATED, {
        templateId: template.id,
        name: template.name,
      })
    );

    return this.formatTemplate(template);
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string) {
    const template = await this.prisma.memoryTemplate.findUnique({
      where: { id },
      include: {
        memories: {
          select: { id: true, key: true },
          take: 10,
        },
      },
    });

    if (!template) {
      throw new NotFoundError('Template', id);
    }

    return this.formatTemplate(template);
  }

  /**
   * List templates
   */
  async listTemplates(filters?: {
    category?: string;
    isPublic?: boolean;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const templates = await this.prisma.memoryTemplate.findMany({
      where,
      orderBy: { usageCount: 'desc' },
      include: {
        _count: {
          select: { memories: true },
        },
      },
    });

    return templates.map((t) => this.formatTemplate(t));
  }

  /**
   * Instantiate a memory from a template
   */
  async instantiateTemplate(
    templateId: string,
    data: {
      key: string;
      variables?: Record<string, string>;
      tags?: string[];
      collectionId?: string;
    }
  ) {
    const template = await this.prisma.memoryTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundError('Template', templateId);
    }

    // Replace variables in content
    let content = template.content;
    const variables = JSON.parse(template.variables as string) as string[];
    const defaultValues = JSON.parse(template.defaultValues as string) as Record<string, string>;

    for (const variable of variables) {
      const value = data.variables?.[variable] || defaultValues[variable] || '';
      const regex = new RegExp(`{{\\s*${variable}\\s*}}`, 'g');
      content = content.replace(regex, value);
    }

    // Check for missing variables
    const missingVars = variables.filter(
      (v) => !data.variables?.[v] && !defaultValues[v] && content.includes(`{{${v}}}`)
    );
    if (missingVars.length > 0) {
      throw new ValidationError(`Missing template variables: ${missingVars.join(', ')}`);
    }

    // Create memory from template
    const memory = await this.prisma.memoryItem.create({
      data: {
        key: data.key,
        content,
        templateId: template.id,
        collectionId: data.collectionId,
        metadata: JSON.stringify({
          instantiatedFrom: template.id,
          variables: data.variables,
        }),
      },
    });

    // Increment usage count
    await this.prisma.memoryTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    await eventBus.emit(
      createEvent(DomainEventType.TEMPLATE_USED, {
        templateId: template.id,
        memoryId: memory.id,
      })
    );

    logger.info(
      { templateId, memoryId: memory.id, key: memory.key },
      'Memory instantiated from template'
    );

    return memory;
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      content?: string;
      variables?: string[];
      defaultValues?: Record<string, any>;
      tags?: string[];
      isPublic?: boolean;
    }
  ) {
    const template = await this.prisma.memoryTemplate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content && { content: data.content }),
        ...(data.variables && { variables: JSON.stringify(data.variables) }),
        ...(data.defaultValues && { defaultValues: JSON.stringify(data.defaultValues) }),
        ...(data.tags && { tags: JSON.stringify(data.tags) }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    return this.formatTemplate(template);
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string) {
    await this.prisma.memoryTemplate.delete({ where: { id } });
    logger.info({ templateId: id }, 'Template deleted');
  }

  private formatTemplate(template: any) {
    return {
      ...template,
      variables: JSON.parse(template.variables as string),
      defaultValues: JSON.parse(template.defaultValues as string),
      tags: JSON.parse(template.tags as string),
    };
  }
}
