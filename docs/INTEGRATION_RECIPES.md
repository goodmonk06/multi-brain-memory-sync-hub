# Integration Recipes

This document provides practical recipes for integrating the Memory Sync Hub with common services and patterns in an AI-driven ecosystem.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Notification Systems](#notification-systems)
3. [Observability & Monitoring](#observability--monitoring)
4. [Real Provider Integrations](#real-provider-integrations)
5. [Event-Driven Architectures](#event-driven-architectures)
6. [Search & Discovery](#search--discovery)
7. [Data Import/Export](#data-importexport)
8. [Multi-Tenancy](#multi-tenancy)

---

## Authentication & Authorization

### Recipe 1: JWT Authentication Middleware

```typescript
// src/lib/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

// Register in routes
fastify.addHook('onRequest', authMiddleware);
```

### Recipe 2: Row-Level Security

```typescript
// Add userId to MemoryItem
model MemoryItem {
  // ... existing fields
  userId String
  user   User   @relation(fields: [userId], references: [id])

  @@index([userId])
}

// Filter by user in services
async listMemories(userId: string, filters: any) {
  return prisma.memoryItem.findMany({
    where: {
      userId,
      ...filters
    }
  });
}
```

---

## Notification Systems

### Recipe 3: Email Notifications on Sync Failures

```typescript
// src/lib/adapters/email.adapter.ts
import nodemailer from 'nodemailer';
import { INotificationAdapter, NotificationPayload } from './notification.adapter';

export class EmailNotificationAdapter implements INotificationAdapter {
  private transporter;

  constructor(config: { host: string; port: number; auth: any }) {
    this.transporter = nodemailer.createTransport(config);
  }

  async send(payload: NotificationPayload): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: payload.recipients?.join(','),
      subject: payload.title,
      html: `
        <h2>${payload.title}</h2>
        <p>${payload.message}</p>
        ${payload.metadata ? `<pre>${JSON.stringify(payload.metadata, null, 2)}</pre>` : ''}
      `,
    });
  }
}

// Register event handler
import { eventBus, DomainEventType } from '../lib/events';
import { notificationAdapter } from '../lib/adapters/notification.adapter';

eventBus.on(DomainEventType.SYNC_FAILED, async (event) => {
  await notificationAdapter.send({
    title: 'Sync Failed',
    message: `Memory "${event.payload.memoryId}" failed to sync to provider`,
    level: 'error',
    metadata: event.payload,
    recipients: ['admin@example.com'],
  });
});
```

### Recipe 4: Slack Webhooks

```typescript
export class SlackNotificationAdapter implements INotificationAdapter {
  constructor(private webhookUrl: string) {}

  async send(payload: NotificationPayload): Promise<void> {
    const color = {
      info: '#36a64f',
      warning: '#ff9800',
      error: '#f44336',
      success: '#4caf50',
    }[payload.level];

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color,
            title: payload.title,
            text: payload.message,
            fields: payload.metadata
              ? Object.entries(payload.metadata).map(([key, value]) => ({
                  title: key,
                  value: String(value),
                  short: true,
                }))
              : [],
          },
        ],
      }),
    });
  }
}
```

---

## Observability & Monitoring

### Recipe 5: Prometheus Metrics

```typescript
// src/lib/adapters/prometheus.adapter.ts
import { metrics } from '../metrics';
import { register, Counter, Gauge, Histogram } from 'prom-client';

// Define Prometheus metrics
const syncCounter = new Counter({
  name: 'memory_sync_total',
  help: 'Total number of sync operations',
  labelNames: ['provider', 'status'],
});

const syncDuration = new Histogram({
  name: 'memory_sync_duration_seconds',
  help: 'Sync operation duration',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Hook into sync events
eventBus.on(DomainEventType.SYNC_COMPLETED, (event) => {
  syncCounter.inc({
    provider: event.payload.providerId,
    status: event.payload.status,
  });

  syncDuration.observe(
    { provider: event.payload.providerId },
    event.payload.durationMs / 1000
  );
});

// Expose metrics endpoint
fastify.get('/metrics/prometheus', async () => {
  return register.metrics();
});
```

### Recipe 6: Distributed Tracing with OpenTelemetry

```typescript
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Instrument sync operations
const tracer = trace.getTracer('memory-sync-hub');

async syncSingleItem(status: MemorySyncStatus) {
  const span = tracer.startSpan('sync.item', {
    attributes: {
      'memory.id': status.memoryItemId,
      'provider.id': status.providerId,
    },
  });

  try {
    // ... sync logic
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## Real Provider Integrations

### Recipe 7: OpenAI Integration

```typescript
// src/services/providers/openai.client.ts
import OpenAI from 'openai';

export class OpenAIClient implements ProviderClient {
  private client: OpenAI;

  constructor(config: { apiKey: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    const { key, content, tags } = params;

    // Option 1: Use fine-tuning (for persistent memory)
    // await this.client.fineTuning.jobs.create({ ... });

    // Option 2: Store in vector database and use in context
    const embedding = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    });

    // Store embedding in your vector DB (Pinecone, Weaviate, etc.)
    await vectorDB.upsert({
      id: key,
      values: embedding.data[0].embedding,
      metadata: { content, tags },
    });

    return {
      success: true,
      externalId: key,
      metadata: { embeddingModel: 'text-embedding-3-small' },
    };
  }

  async deleteMemory(externalId: string): Promise<void> {
    await vectorDB.delete({ ids: [externalId] });
  }
}
```

### Recipe 8: Anthropic Claude Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicClient implements ProviderClient {
  private client: Anthropic;

  constructor(config: { apiKey: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    // Claude doesn't have built-in memory, so store in your own system
    // and inject into system prompts

    const { key, content, tags } = params;

    // Store in Redis or similar for quick retrieval
    await redis.hset(`memories:${params.userId}`, key, JSON.stringify({
      content,
      tags,
      syncedAt: new Date(),
    }));

    return {
      success: true,
      externalId: key,
      metadata: { storageType: 'redis' },
    };
  }

  // When making Claude API calls, inject memories
  async createMessage(userId: string, message: string) {
    const memories = await redis.hgetall(`memories:${userId}`);
    const memoryContext = Object.entries(memories)
      .map(([key, value]) => {
        const data = JSON.parse(value);
        return `[${key}]: ${data.content}`;
      })
      .join('\n');

    return this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `You have access to the following memories:\n\n${memoryContext}\n\nUse these memories to provide personalized responses.`,
      messages: [{ role: 'user', content: message }],
    });
  }
}
```

---

## Event-Driven Architectures

### Recipe 9: RabbitMQ Message Queue

```typescript
import amqp from 'amqplib';

class MessageQueue {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange('memory_events', 'topic', { durable: true });
  }

  async publishEvent(event: AnyDomainEvent) {
    const routingKey = event.type.replace('.', '_');
    this.channel.publish(
      'memory_events',
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );
  }
}

// Hook into event bus
const mq = new MessageQueue();
await mq.connect();

eventBus.onAny(async (event) => {
  await mq.publishEvent(event);
});
```

### Recipe 10: Webhook Dispatcher

```typescript
// src/services/webhook.service.ts
export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  async dispatchWebhook(event: AnyDomainEvent) {
    // Get all registered webhooks for this event type
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        eventTypes: { has: event.type },
        enabled: true,
      },
    });

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': this.generateSignature(event, webhook.secret),
            },
            body: JSON.stringify(event),
          });

          if (!response.ok) {
            logger.error({ webhookId: webhook.id, status: response.status }, 'Webhook failed');
          }
        } catch (error) {
          logger.error({ err: error, webhookId: webhook.id }, 'Webhook error');
        }
      })
    );
  }

  private generateSignature(event: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(event));
    return hmac.digest('hex');
  }
}
```

---

## Search & Discovery

### Recipe 11: Elasticsearch Integration

```typescript
import { Client } from '@elastic/elasticsearch';

export class ElasticsearchAdapter implements ISearchAdapter {
  private client: Client;
  private index = 'memories';

  constructor(config: { node: string }) {
    this.client = new Client(config);
  }

  async index(document: SearchDocument): Promise<void> {
    await this.client.index({
      index: this.index,
      id: document.id,
      document: {
        content: document.content,
        metadata: document.metadata,
        timestamp: new Date(),
      },
    });
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const response = await this.client.search({
      index: this.index,
      body: {
        query: {
          multi_match: {
            query: query.query,
            fields: ['content^2', 'metadata.*'],
          },
        },
        highlight: {
          fields: {
            content: {},
          },
        },
        from: query.offset || 0,
        size: query.limit || 10,
      },
    });

    return response.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      highlights: hit.highlight?.content || [],
      metadata: hit._source.metadata,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.client.delete({ index: this.index, id });
  }
}

// Auto-index memories on creation/update
eventBus.on(DomainEventType.MEMORY_CREATED, async (event) => {
  await searchAdapter.index({
    id: event.payload.memoryId,
    content: event.payload.content,
    metadata: { tags: event.payload.tags },
  });
});
```

---

## Data Import/Export

### Recipe 12: CSV Import

```typescript
import csv from 'csv-parser';
import fs from 'fs';

export class ImportService {
  async importFromCSV(filePath: string) {
    const memories: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          memories.push({
            key: row.key,
            content: row.content,
            category: row.category,
            tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
          });
        })
        .on('end', async () => {
          // Batch insert
          for (const memory of memories) {
            await this.prisma.memoryItem.create({ data: memory });
          }
          resolve(memories.length);
        })
        .on('error', reject);
    });
  }
}
```

### Recipe 13: JSON Export

```typescript
export class ExportService {
  async exportToJSON(filters?: any) {
    const memories = await this.prisma.memoryItem.findMany({
      where: filters,
      include: {
        tags: { include: { tag: true } },
        versions: true,
        collection: true,
      },
    });

    return JSON.stringify(
      memories.map((m) => ({
        key: m.key,
        content: m.content,
        category: m.category,
        tags: m.tags.map((t) => t.tag.name),
        collection: m.collection?.name,
        versions: m.versions.length,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      null,
      2
    );
  }
}
```

---

## Multi-Tenancy

### Recipe 14: Workspace-Based Isolation

```typescript
// Add workspace model
model Workspace {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  ownerId     String
  createdAt   DateTime @default(now())

  memories    MemoryItem[]
  providers   Provider[]
  users       WorkspaceUser[]
}

model WorkspaceUser {
  workspaceId String
  userId      String
  role        String // OWNER, ADMIN, MEMBER

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  user      User      @relation(fields: [userId], references: [id])

  @@id([workspaceId, userId])
}

// Middleware to inject workspace context
fastify.addHook('onRequest', async (request, reply) => {
  const workspaceSlug = request.headers['x-workspace'];
  if (workspaceSlug) {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });
    request.workspace = workspace;
  }
});

// Filter all queries by workspace
async listMemories() {
  return prisma.memoryItem.findMany({
    where: { workspaceId: request.workspace.id },
  });
}
```

---

## Summary

These recipes demonstrate how to integrate the Memory Sync Hub with common enterprise services and patterns. The extensible architecture makes it easy to:

1. Add custom authentication/authorization
2. Integrate with any notification service
3. Export metrics to monitoring platforms
4. Connect to real LLM provider APIs
5. Build event-driven workflows
6. Add powerful search capabilities
7. Import/export data in various formats
8. Support multi-tenant deployments

For more examples, see the `/examples` directory in the repository.
