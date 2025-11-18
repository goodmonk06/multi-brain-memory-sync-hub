# Domain Model Deep Dive

## Overview

The Memory Sync Hub is built around a rich domain model that supports memory management, template-based creation, version control, organization, and multi-provider synchronization.

## Core Entities

### MemoryItem

The central entity representing a canonical memory that should be synced across providers.

**Fields:**
- `id`: Unique identifier (UUID)
- `key`: Human-readable unique key (e.g., "user_preferences")
- `content`: The actual memory content (Text)
- `description`: Optional description
- `category`: Optional categorization (e.g., "preferences", "context", "skills")
- `priority`: Integer priority (0=normal, higher=more important)
- `expiresAt`: Optional expiration timestamp
- `archived`: Soft delete flag
- `templateId`: Optional reference to template used
- `collectionId`: Optional reference to collection
- `metadata`: JSON metadata for custom fields

**Relationships:**
- `template`: MemoryTemplate (many-to-one)
- `collection`: MemoryCollection (many-to-one)
- `syncStatuses`: MemorySyncStatus[] (one-to-many)
- `versions`: MemoryVersion[] (one-to-many)
- `tags`: MemoryTag[] (many-to-many through join table)
- `auditLogs`: AuditLog[] (one-to-many)

**Business Rules:**
1. `key` must be unique across all memories
2. Archived memories are not synced
3. Expired memories (expiresAt < now) can be automatically archived
4. Updates create new versions
5. Priority affects sync order (higher first)

### MemoryTemplate

Reusable patterns for creating memories with variable substitution.

**Fields:**
- `id`: Unique identifier
- `name`: Unique template name
- `description`: Template description
- `category`: Template category
- `content`: Template content with {{variables}}
- `variables`: Array of variable names
- `defaultValues`: Default values for variables
- `tags`: Default tags for instantiated memories
- `isPublic`: Whether template is publicly available
- `usageCount`: Number of times used

**Relationships:**
- `memories`: MemoryItem[] (one-to-many)

**Business Rules:**
1. Variables in content must be defined in variables array
2. Variable syntax: `{{variableName}}`
3. Default values used when variable not provided
4. Usage count increments on each instantiation
5. Cannot delete template with active memories (use soft delete)

**Example Template:**
```json
{
  "name": "meeting_notes",
  "content": "Meeting with {{attendees}} on {{date}}. Topics: {{topics}}. Action items: {{actions}}",
  "variables": ["attendees", "date", "topics", "actions"],
  "defaultValues": {
    "date": "{{TODAY}}",
    "actions": "None"
  }
}
```

### MemoryVersion

Complete version history for memories with change tracking.

**Fields:**
- `id`: Unique identifier
- `memoryItemId`: Reference to memory
- `version`: Sequential version number
- `content`: Content at this version
- `description`: Change description
- `metadata`: Additional version metadata
- `tags`: Tags at this version
- `changeType`: CREATED | UPDATED | RESTORED
- `changedBy`: User/system identifier
- `createdAt`: Version timestamp

**Relationships:**
- `memoryItem`: MemoryItem (many-to-one)

**Business Rules:**
1. Versions are immutable once created
2. Version numbers are sequential per memory (1, 2, 3...)
3. First version has changeType=CREATED
4. Can restore to any previous version (creates new version with changeType=RESTORED)

### Tag

First-class tag entity with hierarchical organization.

**Fields:**
- `id`: Unique identifier
- `name`: Unique tag name
- `description`: Tag description
- `category`: Tag category
- `color`: Display color (hex code)
- `parentId`: Optional parent tag for hierarchy
- `metadata`: Additional tag metadata

**Relationships:**
- `parent`: Tag (self-reference, many-to-one)
- `children`: Tag[] (self-reference, one-to-many)
- `memories`: MemoryTag[] (many-to-many through join table)

**Business Rules:**
1. Tag names are case-insensitive unique
2. Hierarchical tags support multi-level organization
3. Cannot create circular references in hierarchy
4. Deleting a tag requires reassignment or cascade

**Example Hierarchy:**
```
skills
├── technical
│   ├── programming
│   │   ├── typescript
│   │   └── python
│   └── databases
└── soft-skills
    ├── communication
    └── leadership
```

### MemoryCollection

Grouping and organization of related memories.

**Fields:**
- `id`: Unique identifier
- `name`: Unique collection name
- `description`: Collection description
- `category`: Collection category
- `color`: Display color
- `icon`: Display icon
- `parentId`: Optional parent collection for hierarchy
- `metadata`: Additional metadata

**Relationships:**
- `parent`: MemoryCollection (self-reference, many-to-one)
- `children`: MemoryCollection[] (self-reference, one-to-many)
- `memories`: MemoryItem[] (one-to-many)

**Business Rules:**
1. Collections can be nested hierarchically
2. Cannot create circular references
3. Moving a collection moves all child collections and memories

**Example Organization:**
```
Projects
├── Project Alpha
│   ├── Requirements
│   ├── Technical Specs
│   └── Meeting Notes
└── Project Beta
    └── Research
```

### Provider

Configuration for LLM providers.

**Fields:**
- `id`: Unique identifier
- `name`: Unique provider name
- `type`: OPENAI | ANTHROPIC | GOOGLE | OTHER
- `configJson`: Provider-specific configuration
- `enabled`: Whether provider is active
- `priority`: Sync priority (higher first)
- `timeout`: Request timeout (ms)
- `retryAttempts`: Number of retries on failure
- `healthCheckUrl`: Optional health check endpoint
- `metadata`: Additional metadata

**Relationships:**
- `syncStatuses`: MemorySyncStatus[] (one-to-many)
- `healthChecks`: ProviderHealthCheck[] (one-to-many)
- `auditLogs`: AuditLog[] (one-to-many)

**Business Rules:**
1. Disabled providers don't sync
2. Higher priority providers sync first
3. Config must match provider type schema
4. Can't delete provider with active syncs

### MemorySyncStatus

Tracks sync state for each memory-provider pair.

**Fields:**
- `id`: Unique identifier
- `memoryItemId`: Reference to memory
- `providerId`: Reference to provider
- `batchId`: Optional batch reference
- `lastSyncedAt`: Last successful sync timestamp
- `status`: PENDING | SYNCING | SUCCESS | FAILED
- `attempts`: Number of sync attempts
- `errorMessage`: Last error message
- `errorCode`: Last error code
- `durationMs`: Last sync duration
- `externalId`: Provider's reference ID
- `metaJson`: Additional sync metadata

**Relationships:**
- `memoryItem`: MemoryItem (many-to-one)
- `provider`: Provider (many-to-one)
- `batch`: SyncBatch (many-to-one, optional)

**Business Rules:**
1. Unique constraint on (memoryItemId, providerId)
2. State machine: PENDING → SYNCING → SUCCESS/FAILED
3. FAILED status can be reset to PENDING for retry
4. Max retry attempts configurable per provider

### SyncBatch

Batch sync operations with aggregate tracking.

**Fields:**
- `id`: Unique identifier
- `name`: Optional batch name
- `status`: PENDING | RUNNING | COMPLETED | FAILED
- `totalItems`: Total items in batch
- `completed`: Completed items count
- `failed`: Failed items count
- `startedAt`: Batch start timestamp
- `completedAt`: Batch completion timestamp
- `metadata`: Additional batch metadata

**Relationships:**
- `syncStatuses`: MemorySyncStatus[] (one-to-many)

**Business Rules:**
1. Batch completion triggers event
2. Batch status updates based on item statuses
3. Can retry entire batch or individual failures

### ProviderHealthCheck

Automated health monitoring for providers.

**Fields:**
- `id`: Unique identifier
- `providerId`: Reference to provider
- `status`: HEALTHY | DEGRADED | DOWN
- `responseTimeMs`: Response time
- `statusCode`: HTTP status code
- `errorMessage`: Error if health check failed
- `metadata`: Additional health data
- `checkedAt`: Health check timestamp

**Relationships:**
- `provider`: Provider (many-to-one)

**Business Rules:**
1. Health checks run periodically
2. Status affects provider selection
3. Degraded providers have lower priority
4. Down providers are temporarily disabled

### AuditLog

Complete audit trail for all operations.

**Fields:**
- `id`: Unique identifier
- `entityType`: MEMORY | PROVIDER | SYNC_STATUS | etc.
- `entityId`: ID of affected entity
- `action`: CREATED | UPDATED | DELETED | SYNCED | etc.
- `actorId`: User/system identifier
- `memoryItemId`: Optional memory reference
- `providerId`: Optional provider reference
- `changes`: Before/after values
- `metadata`: Additional context
- `createdAt`: Action timestamp

**Relationships:**
- `memoryItem`: MemoryItem (many-to-one, optional)
- `provider`: Provider (many-to-one, optional)

**Business Rules:**
1. Audit logs are immutable
2. All significant operations must be logged
3. Retention policy configurable

## Domain Events

The system emits domain events for integration:

### Memory Events
- `memory.created`: New memory created
- `memory.updated`: Memory content/metadata changed
- `memory.deleted`: Memory deleted
- `memory.archived`: Memory archived
- `memory.restored`: Memory unarchived

### Provider Events
- `provider.created`: New provider configured
- `provider.updated`: Provider settings changed
- `provider.enabled`: Provider activated
- `provider.disabled`: Provider deactivated

### Sync Events
- `sync.started`: Sync operation initiated
- `sync.completed`: Sync operation finished
- `sync.failed`: Sync operation failed
- `sync.batch.started`: Batch sync started
- `sync.batch.completed`: Batch sync finished

### Template Events
- `template.created`: New template created
- `template.used`: Template instantiated

### Health Events
- `health.check.completed`: Health check finished
- `health.status.changed`: Provider health status changed

## Extension Points

### 1. Custom Provider Types

Implement `IProviderAdapter`:
```typescript
interface IProviderAdapter {
  syncMemory(params: SyncMemoryParams): Promise<SyncResult>;
  deleteMemory(externalId: string): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}
```

### 2. Event Handlers

Subscribe to domain events:
```typescript
eventBus.on(DomainEventType.MEMORY_CREATED, async (event) => {
  // Custom logic
});
```

### 3. Notification Adapters

Implement `INotificationAdapter`:
```typescript
interface INotificationAdapter {
  send(payload: NotificationPayload): Promise<void>;
}
```

### 4. Storage Adapters

Implement `IStorageAdapter`:
```typescript
interface IStorageAdapter {
  put(object: StorageObject): Promise<string>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}
```

### 5. Search Adapters

Implement `ISearchAdapter`:
```typescript
interface ISearchAdapter {
  index(document: SearchDocument): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}
```

## Query Patterns

### Common Queries

**Find active memories for sync:**
```typescript
const memories = await prisma.memoryItem.findMany({
  where: {
    archived: false,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ]
  },
  include: {
    syncStatuses: {
      where: {
        provider: { enabled: true },
        status: 'PENDING'
      }
    }
  }
});
```

**Get memory with full history:**
```typescript
const memory = await prisma.memoryItem.findUnique({
  where: { key: 'user_prefs' },
  include: {
    versions: { orderBy: { version: 'desc' } },
    tags: { include: { tag: true } },
    collection: true,
    template: true
  }
});
```

**Search by tags:**
```typescript
const memories = await prisma.memoryItem.findMany({
  where: {
    tags: {
      some: {
        tag: {
          name: { in: ['important', 'urgent'] }
        }
      }
    }
  }
});
```

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried fields are indexed
2. **Batch Operations**: Use transactions for multi-record operations
3. **Pagination**: Implement cursor-based pagination for large result sets
4. **Caching**: Consider Redis for frequently accessed data
5. **Async Processing**: Use event bus for non-critical operations

## Future Enhancements

1. **Memory Sharing**: Share memories between users/workspaces
2. **Access Control**: Role-based permissions on memories and collections
3. **Smart Suggestions**: ML-powered tag and collection suggestions
4. **Conflict Resolution**: Handle concurrent updates to same memory
5. **Bulk Operations**: Import/export large memory sets
6. **Webhooks**: External system notifications on events
