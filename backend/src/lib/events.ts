import { logger } from './logger';

// Domain Event Types
export enum DomainEventType {
  MEMORY_CREATED = 'memory.created',
  MEMORY_UPDATED = 'memory.updated',
  MEMORY_DELETED = 'memory.deleted',
  MEMORY_ARCHIVED = 'memory.archived',
  MEMORY_RESTORED = 'memory.restored',

  PROVIDER_CREATED = 'provider.created',
  PROVIDER_UPDATED = 'provider.updated',
  PROVIDER_DELETED = 'provider.deleted',
  PROVIDER_ENABLED = 'provider.enabled',
  PROVIDER_DISABLED = 'provider.disabled',

  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  SYNC_BATCH_STARTED = 'sync.batch.started',
  SYNC_BATCH_COMPLETED = 'sync.batch.completed',

  TEMPLATE_CREATED = 'template.created',
  TEMPLATE_USED = 'template.used',

  HEALTH_CHECK_COMPLETED = 'health.check.completed',
  HEALTH_STATUS_CHANGED = 'health.status.changed',
}

// Base event interface
export interface DomainEvent {
  id: string;
  type: DomainEventType;
  timestamp: Date;
  actorId?: string;
  metadata?: Record<string, any>;
}

// Specific event payloads
export interface MemoryCreatedEvent extends DomainEvent {
  type: DomainEventType.MEMORY_CREATED;
  payload: {
    memoryId: string;
    key: string;
    content: string;
    tags: string[];
  };
}

export interface MemoryUpdatedEvent extends DomainEvent {
  type: DomainEventType.MEMORY_UPDATED;
  payload: {
    memoryId: string;
    key: string;
    changes: Record<string, any>;
  };
}

export interface MemoryDeletedEvent extends DomainEvent {
  type: DomainEventType.MEMORY_DELETED;
  payload: {
    memoryId: string;
    key: string;
  };
}

export interface ProviderCreatedEvent extends DomainEvent {
  type: DomainEventType.PROVIDER_CREATED;
  payload: {
    providerId: string;
    name: string;
    type: string;
  };
}

export interface ProviderUpdatedEvent extends DomainEvent {
  type: DomainEventType.PROVIDER_UPDATED;
  payload: {
    providerId: string;
    name: string;
    changes: Record<string, any>;
  };
}

export interface SyncCompletedEvent extends DomainEvent {
  type: DomainEventType.SYNC_COMPLETED;
  payload: {
    memoryId: string;
    providerId: string;
    status: 'SUCCESS' | 'FAILED';
    durationMs: number;
    externalId?: string;
  };
}

export interface SyncBatchCompletedEvent extends DomainEvent {
  type: DomainEventType.SYNC_BATCH_COMPLETED;
  payload: {
    batchId: string;
    totalItems: number;
    successCount: number;
    failedCount: number;
    durationMs: number;
  };
}

export interface HealthCheckCompletedEvent extends DomainEvent {
  type: DomainEventType.HEALTH_CHECK_COMPLETED;
  payload: {
    providerId: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    responseTimeMs: number;
  };
}

// Union type of all events
export type AnyDomainEvent =
  | MemoryCreatedEvent
  | MemoryUpdatedEvent
  | MemoryDeletedEvent
  | ProviderCreatedEvent
  | ProviderUpdatedEvent
  | SyncCompletedEvent
  | SyncBatchCompletedEvent
  | HealthCheckCompletedEvent;

// Event handler type
export type EventHandler<T extends DomainEvent = AnyDomainEvent> = (event: T) => Promise<void> | void;

// Event bus
class EventBus {
  private handlers: Map<DomainEventType, EventHandler[]> = new Map();
  private globalHandlers: EventHandler<AnyDomainEvent>[] = [];

  /**
   * Subscribe to a specific event type
   */
  on<T extends AnyDomainEvent>(eventType: DomainEventType, handler: EventHandler<T>) {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);

    logger.debug({ eventType }, 'Event handler registered');
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler<AnyDomainEvent>) {
    this.globalHandlers.push(handler);
    logger.debug('Global event handler registered');
  }

  /**
   * Unsubscribe from an event
   */
  off(eventType: DomainEventType, handler: EventHandler) {
    const handlers = this.handlers.get(eventType) || [];
    const filtered = handlers.filter((h) => h !== handler);
    this.handlers.set(eventType, filtered);
  }

  /**
   * Emit an event
   */
  async emit(event: AnyDomainEvent) {
    logger.info({ eventType: event.type, eventId: event.id }, 'Emitting domain event');

    // Execute type-specific handlers
    const handlers = this.handlers.get(event.type) || [];
    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error: any) {
          logger.error(
            { err: error, eventType: event.type, eventId: event.id },
            'Event handler error'
          );
        }
      })
    );

    // Execute global handlers
    await Promise.allSettled(
      this.globalHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error: any) {
          logger.error(
            { err: error, eventType: event.type, eventId: event.id },
            'Global event handler error'
          );
        }
      })
    );
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear() {
    this.handlers.clear();
    this.globalHandlers = [];
  }

  /**
   * Get handler count for debugging
   */
  getHandlerCount(eventType?: DomainEventType): number {
    if (eventType) {
      return (this.handlers.get(eventType) || []).length;
    }
    return Array.from(this.handlers.values()).reduce((sum, arr) => sum + arr.length, 0) +
      this.globalHandlers.length;
  }
}

// Singleton event bus
export const eventBus = new EventBus();

// Helper to create events
export function createEvent<T extends AnyDomainEvent>(
  type: DomainEventType,
  payload: any,
  metadata?: Record<string, any>
): T {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date(),
    payload,
    metadata,
  } as T;
}
