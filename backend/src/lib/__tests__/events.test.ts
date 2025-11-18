import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus, createEvent, DomainEventType } from '../events';

describe('Event System', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  describe('EventBus', () => {
    it('should register and emit events', async () => {
      let called = false;
      let receivedEvent: any;

      eventBus.on(DomainEventType.MEMORY_CREATED, (event) => {
        called = true;
        receivedEvent = event;
      });

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test-id',
        key: 'test-key',
        content: 'test content',
        tags: ['test'],
      });

      await eventBus.emit(event);

      expect(called).toBe(true);
      expect(receivedEvent.type).toBe(DomainEventType.MEMORY_CREATED);
      expect(receivedEvent.payload.memoryId).toBe('test-id');
    });

    it('should support multiple handlers for same event', async () => {
      let count = 0;

      eventBus.on(DomainEventType.MEMORY_CREATED, () => {
        count++;
      });

      eventBus.on(DomainEventType.MEMORY_CREATED, () => {
        count++;
      });

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test',
        key: 'test',
        content: 'test',
        tags: [],
      });

      await eventBus.emit(event);

      expect(count).toBe(2);
    });

    it('should support global handlers', async () => {
      let globalCalled = false;
      let specificCalled = false;

      eventBus.onAny(() => {
        globalCalled = true;
      });

      eventBus.on(DomainEventType.MEMORY_CREATED, () => {
        specificCalled = true;
      });

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test',
        key: 'test',
        content: 'test',
        tags: [],
      });

      await eventBus.emit(event);

      expect(globalCalled).toBe(true);
      expect(specificCalled).toBe(true);
    });

    it('should handle async handlers', async () => {
      let resolved = false;

      eventBus.on(DomainEventType.MEMORY_CREATED, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test',
        key: 'test',
        content: 'test',
        tags: [],
      });

      await eventBus.emit(event);

      expect(resolved).toBe(true);
    });

    it('should not fail if handler throws error', async () => {
      let secondHandlerCalled = false;

      eventBus.on(DomainEventType.MEMORY_CREATED, () => {
        throw new Error('Handler error');
      });

      eventBus.on(DomainEventType.MEMORY_CREATED, () => {
        secondHandlerCalled = true;
      });

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test',
        key: 'test',
        content: 'test',
        tags: [],
      });

      await eventBus.emit(event);

      expect(secondHandlerCalled).toBe(true);
    });

    it('should unsubscribe handlers', async () => {
      let called = false;

      const handler = () => {
        called = true;
      };

      eventBus.on(DomainEventType.MEMORY_CREATED, handler);
      eventBus.off(DomainEventType.MEMORY_CREATED, handler);

      const event = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test',
        key: 'test',
        content: 'test',
        tags: [],
      });

      await eventBus.emit(event);

      expect(called).toBe(false);
    });

    it('should report handler counts', () => {
      eventBus.on(DomainEventType.MEMORY_CREATED, () => {});
      eventBus.on(DomainEventType.MEMORY_UPDATED, () => {});
      eventBus.onAny(() => {});

      expect(eventBus.getHandlerCount()).toBe(3);
      expect(eventBus.getHandlerCount(DomainEventType.MEMORY_CREATED)).toBe(1);
    });
  });

  describe('createEvent', () => {
    it('should create event with required fields', () => {
      const event = createEvent(DomainEventType.SYNC_COMPLETED, {
        memoryId: 'mem-1',
        providerId: 'prov-1',
        status: 'SUCCESS',
        durationMs: 100,
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe(DomainEventType.SYNC_COMPLETED);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.payload.memoryId).toBe('mem-1');
    });

    it('should include metadata if provided', () => {
      const metadata = { userId: 'user-123', requestId: 'req-456' };
      const event = createEvent(
        DomainEventType.MEMORY_CREATED,
        { memoryId: 'test', key: 'test', content: 'test', tags: [] },
        metadata
      );

      expect(event.metadata).toEqual(metadata);
    });

    it('should generate unique event IDs', () => {
      const event1 = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test1',
        key: 'test1',
        content: 'test',
        tags: [],
      });

      const event2 = createEvent(DomainEventType.MEMORY_CREATED, {
        memoryId: 'test2',
        key: 'test2',
        content: 'test',
        tags: [],
      });

      expect(event1.id).not.toBe(event2.id);
    });
  });
});
