# Multi-Brain Memory Sync Hub

A centralized hub for storing canonical memory items and syncing them across multiple LLM providers (ChatGPT, Claude, Gemini, etc.). This system maintains a single source of truth for memories and ensures they're propagated to all configured AI assistants.

## Overview

The Memory Sync Hub acts as a central repository for user memories, preferences, and contextual information that should be available across different LLM providers. It automatically syncs these memories to each provider using their respective APIs or memory systems.

### Key Features

- **Centralized Memory Storage**: Single source of truth for all memory items
- **Multi-Provider Sync**: Automatic synchronization to multiple LLM providers
- **Sync State Tracking**: Detailed status tracking for each memory-provider combination
- **Real-time Dashboard**: Web UI for monitoring and managing memories and sync status
- **Background Jobs**: Automatic retry and sync processing
- **Extensible Architecture**: Easy to add new provider integrations

## Architecture

### Tech Stack

- **Backend**: Node.js, Fastify, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Next.js 14, React, TypeScript
- **Sync Engine**: Background job processor with retry logic

### Domain Model

#### MemoryItem
Represents a canonical memory that should be synced across providers.

```typescript
{
  id: string;           // UUID
  key: string;          // Unique identifier (e.g., "user_preferences")
  content: string;      // The actual memory content
  tagsJson: string;     // JSON array of tags for categorization
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

#### Provider
Represents an LLM provider configuration.

```typescript
{
  id: string;
  name: string;         // Display name (e.g., "ChatGPT")
  type: ProviderType;   // OPENAI | ANTHROPIC | GOOGLE | OTHER
  configJson: string;   // JSON config (API keys, endpoints, etc.)
  enabled: boolean;     // Whether syncing is active for this provider
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

#### MemorySyncStatus
Tracks the sync state for each memory-provider pair.

```typescript
{
  id: string;
  memoryItemId: string;
  providerId: string;
  status: SyncStatus;     // PENDING | SYNCING | SUCCESS | FAILED
  lastSyncedAt: DateTime | null;
  metaJson: string;       // JSON metadata (errors, provider responses, etc.)
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### Sync State Machine

```
PENDING → SYNCING → SUCCESS
                  ↓
                FAILED → (can be reset to PENDING for retry)
```

**State Transitions:**

1. **PENDING**: Memory needs to be synced to provider
   - Triggered by: New memory creation, memory update, provider enabled
2. **SYNCING**: Sync operation in progress
   - Triggered by: Background sync job picks up pending item
3. **SUCCESS**: Successfully synced to provider
   - Triggered by: Provider API call succeeds
4. **FAILED**: Sync operation failed
   - Triggered by: Provider API error, network issue, etc.
   - Can be manually retried (reset to PENDING)

### Sync Logic Flow

1. **Background Job** runs every 10 seconds (configurable)
2. Finds all `PENDING` sync statuses for enabled providers
3. Processes up to 10 syncs in parallel (configurable batch size)
4. For each sync:
   - Mark status as `SYNCING`
   - Get appropriate provider client based on type
   - Call provider's `syncMemory` method
   - Update status to `SUCCESS` or `FAILED` based on result
5. Failed syncs can be retried via API or UI

## Project Structure

```
multi-brain-memory-sync-hub/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── index.ts               # Server entry point
│   │   ├── routes/
│   │   │   ├── memory.routes.ts   # Memory CRUD endpoints
│   │   │   ├── provider.routes.ts # Provider management endpoints
│   │   │   └── sync.routes.ts     # Sync control endpoints
│   │   ├── services/
│   │   │   ├── sync.service.ts    # Sync orchestration
│   │   │   └── providers/
│   │   │       ├── provider-client.ts      # Base interface
│   │   │       ├── openai.client.ts        # OpenAI stub
│   │   │       ├── anthropic.client.ts     # Anthropic stub
│   │   │       ├── google.client.ts        # Google stub
│   │   │       └── default.client.ts       # Fallback stub
│   │   └── prisma/
│   │       └── seed.ts            # Database seeding
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── memories/page.tsx  # Memory management
│   │   │   ├── providers/page.tsx # Provider management
│   │   │   ├── sync/page.tsx      # Sync status viewer
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   └── lib/
│   │       └── api.ts             # API client
│   ├── package.json
│   └── tsconfig.json
└── package.json                   # Workspace root
```

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: use the version in `.nvmrc`)
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd multi-brain-memory-sync-hub
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up the database**

Create a PostgreSQL database and configure the connection string:

```bash
cd backend
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string
```

4. **Run database migrations**

```bash
npm run db:migrate
```

5. **Seed the database** (optional but recommended for testing)

```bash
npm run db:seed
```

This creates:
- 4 providers (ChatGPT, Claude, Gemini, Perplexity)
- 6 sample memory items
- Sync statuses for all memory-provider combinations

### Running the Application

#### Development Mode

Run both backend and frontend in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

#### Production Build

```bash
npm run build
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

## API Reference

### Memory Endpoints

#### `GET /api/memories`
List all memory items with sync statuses.

**Response:**
```json
[
  {
    "id": "uuid",
    "key": "user_preferences",
    "content": "User prefers concise responses...",
    "tags": ["preferences", "communication"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "syncStatuses": [...]
  }
]
```

#### `POST /api/memories`
Create a new memory item.

**Request:**
```json
{
  "key": "memory_key",
  "content": "Memory content",
  "tags": ["tag1", "tag2"]
}
```

**Response:** Created memory item (201)

#### `PUT /api/memories/:id`
Update a memory item. Marks all sync statuses as PENDING.

**Request:**
```json
{
  "content": "Updated content",
  "tags": ["new", "tags"]
}
```

#### `DELETE /api/memories/:id`
Delete a memory item and all associated sync statuses.

### Provider Endpoints

#### `GET /api/providers`
List all providers with sync statistics.

#### `POST /api/providers`
Create a new provider. Creates PENDING sync statuses for all memories if enabled.

**Request:**
```json
{
  "name": "My Provider",
  "type": "OPENAI",
  "config": {
    "apiKey": "sk-...",
    "model": "gpt-4"
  },
  "enabled": true
}
```

#### `PUT /api/providers/:id`
Update provider configuration or enable/disable.

#### `DELETE /api/providers/:id`
Delete a provider and all associated sync statuses.

### Sync Endpoints

#### `GET /api/sync/overview`
Get aggregated sync statistics.

**Response:**
```json
{
  "total": 24,
  "byStatus": {
    "pending": 0,
    "syncing": 2,
    "success": 20,
    "failed": 2
  },
  "byProvider": {
    "ChatGPT": { "total": 6, "pending": 0, "success": 5, "failed": 1 },
    "Claude": { "total": 6, "pending": 0, "success": 6, "failed": 0 }
  }
}
```

#### `GET /api/sync/status`
Get detailed sync status for all memory-provider pairs.

#### `POST /api/sync/trigger`
Manually trigger a sync cycle.

#### `POST /api/sync/retry-failed`
Reset all failed syncs to PENDING and trigger sync.

## Provider Integration Guide

### Current Implementation (Stubs)

The current implementation uses stub clients that simulate API calls without making real network requests. This allows the system to be tested and developed without requiring actual API credentials.

### Adding Real Provider Integrations

To connect to real provider APIs, update the respective client files in `backend/src/services/providers/`:

#### OpenAI Integration Example

```typescript
// backend/src/services/providers/openai.client.ts
import OpenAI from 'openai';

export class OpenAIClient implements ProviderClient {
  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    const { key, content, tags, config } = params;

    const openai = new OpenAI({
      apiKey: config.apiKey,
    });

    // Option 1: Use OpenAI Memory API (when available)
    // await openai.memory.create({ key, content, metadata: { tags } });

    // Option 2: Store in vector database and reference in prompts
    // await vectorDB.upsert({ id: key, content, metadata: { tags } });

    // Option 3: Inject into system prompt context
    // This would be application-specific

    return {
      success: true,
      externalId: `openai_${Date.now()}`,
      metadata: { /* provider-specific data */ },
    };
  }
}
```

#### Anthropic (Claude) Integration Example

```typescript
// backend/src/services/providers/anthropic.client.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicClient implements ProviderClient {
  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    const { key, content, tags, config } = params;

    // Anthropic doesn't have a built-in memory API yet
    // Common approaches:

    // 1. Store in your own vector database
    // 2. Include in system prompts for each conversation
    // 3. Use RAG (Retrieval Augmented Generation)

    // Example: Store in Pinecone/Weaviate/etc
    await myVectorDB.upsert({
      id: key,
      vector: await generateEmbedding(content),
      metadata: { content, tags, provider: 'anthropic' },
    });

    return {
      success: true,
      externalId: `anthropic_${Date.now()}`,
    };
  }
}
```

#### Google (Gemini) Integration Example

```typescript
// backend/src/services/providers/google.client.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GoogleClient implements ProviderClient {
  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    const { key, content, tags, config } = params;

    const genAI = new GoogleGenerativeAI(config.apiKey);

    // Store in Google AI Studio or custom solution
    // Similar approaches to Anthropic

    return {
      success: true,
      externalId: `google_${Date.now()}`,
    };
  }
}
```

### Configuration Schema

Each provider's `configJson` field should contain:

**OpenAI:**
```json
{
  "apiKey": "sk-...",
  "organizationId": "org-...",
  "model": "gpt-4"
}
```

**Anthropic:**
```json
{
  "apiKey": "sk-ant-...",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Google:**
```json
{
  "apiKey": "AIza...",
  "model": "gemini-pro"
}
```

### Memory Retrieval Strategies

When integrating with real providers, consider these strategies for memory retrieval:

1. **System Prompt Injection**: Include relevant memories in system prompts
2. **RAG (Retrieval Augmented Generation)**: Use vector similarity search
3. **Provider Memory APIs**: Use native memory features (when available)
4. **Context Windows**: Leverage large context windows (Claude 200k, etc.)

## UI Features

### Dashboard
- Overview of memory count, provider status, and sync statistics
- Quick actions to trigger sync or retry failed syncs
- Provider-level sync status breakdown
- Recent memories preview

### Memory Management
- List all memories with sync status
- Create new memories
- Delete memories
- View sync status per memory

### Provider Management
- List all configured providers
- Enable/disable providers
- View sync statistics per provider
- Inspect provider configuration

### Sync Status
- Detailed view of all sync operations
- Filter by status (all, pending, success, failed)
- Manual sync triggering
- Bulk retry of failed syncs
- View error details and provider responses

## Development Notes

### Customization

- **Sync Interval**: Modify `syncIntervalMs` in `backend/src/services/sync.service.ts` (default: 10 seconds)
- **Batch Size**: Modify `take` parameter in sync query (default: 10 concurrent syncs)
- **Simulated Failures**: Adjust failure rates in stub clients for testing

### Adding New Providers

1. Add provider type to Prisma schema enum
2. Create new provider client implementing `ProviderClient` interface
3. Update `ProviderClientFactory` to instantiate your client
4. Seed or create provider via API/UI

### Error Handling

All sync errors are captured in the `metaJson` field of `MemorySyncStatus`:

```json
{
  "error": "OpenAI API rate limit exceeded",
  "errorStack": "...",
  "failedAt": "2024-01-01T00:00:00Z"
}
```

Failed syncs can be inspected in the UI and retried manually or automatically.

## Vertical Slice Test

To test the complete system end-to-end:

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Verify seeded data**
   - Open http://localhost:3000
   - Check dashboard shows 6 memories, 3 active providers
   - Observe sync statuses updating in real-time

3. **Create a new memory**
   - Navigate to "Memories" page
   - Click "+ Add Memory"
   - Fill in key, content, and tags
   - Submit and verify sync statuses are created

4. **Monitor sync progress**
   - Navigate to "Sync Status" page
   - Watch as PENDING → SYNCING → SUCCESS
   - Some syncs may fail (simulated) - verify they show FAILED status

5. **Retry failed syncs**
   - Click "Retry Failed" button
   - Verify failed syncs reset to PENDING
   - Watch them sync again

6. **Disable a provider**
   - Navigate to "Providers" page
   - Click "Disable" on a provider
   - Verify it stops syncing

7. **Enable provider**
   - Click "Enable" on disabled provider
   - Verify sync statuses are created and syncing resumes

## Future Enhancements

- **Real-time sync notifications** (WebSocket)
- **Memory versioning and history**
- **Memory search and filtering** (by tags, content, etc.)
- **Provider health checks and monitoring**
- **Sync scheduling** (cron-based syncing)
- **Memory templates** (predefined memory structures)
- **Bulk import/export** (CSV, JSON)
- **Authentication and multi-tenancy**
- **Analytics and usage metrics**
- **Provider-specific optimizations** (batching, rate limiting)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

---

**Built with TypeScript, Fastify, Prisma, and Next.js**
