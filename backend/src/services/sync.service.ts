import { PrismaClient, MemorySyncStatus, SyncStatus } from '@prisma/client';
import { ProviderClient, ProviderClientFactory } from './providers/provider-client';

export class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncIntervalMs = 10000; // 10 seconds

  constructor(private prisma: PrismaClient) {}

  /**
   * Start background sync job that periodically checks for pending syncs
   */
  startBackgroundSync() {
    if (this.syncInterval) {
      return;
    }

    console.log(`Starting background sync job (every ${this.syncIntervalMs}ms)`);

    this.syncInterval = setInterval(() => {
      this.runSync();
    }, this.syncIntervalMs);

    // Run immediately on start
    this.runSync();
  }

  /**
   * Stop background sync job
   */
  stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Background sync job stopped');
    }
  }

  /**
   * Trigger an immediate sync check
   */
  triggerSync() {
    // Don't wait for the next interval, run immediately
    setImmediate(() => this.runSync());
  }

  /**
   * Main sync orchestration method
   */
  private async runSync() {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      // Find all pending sync statuses
      const pendingStatuses = await this.prisma.memorySyncStatus.findMany({
        where: {
          status: 'PENDING',
          provider: {
            enabled: true,
          },
        },
        include: {
          memoryItem: true,
          provider: true,
        },
        take: 10, // Process in batches
      });

      if (pendingStatuses.length === 0) {
        return;
      }

      console.log(`Processing ${pendingStatuses.length} pending syncs`);

      // Process syncs in parallel (with reasonable concurrency)
      await Promise.allSettled(
        pendingStatuses.map((status) => this.syncSingleItem(status))
      );
    } catch (error) {
      console.error('Error in sync process:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single memory item to a single provider
   */
  private async syncSingleItem(
    status: MemorySyncStatus & {
      memoryItem: any;
      provider: any;
    }
  ) {
    const { id, memoryItem, provider } = status;

    try {
      // Mark as syncing
      await this.prisma.memorySyncStatus.update({
        where: { id },
        data: {
          status: 'SYNCING',
        },
      });

      console.log(
        `Syncing memory "${memoryItem.key}" to provider "${provider.name}"`
      );

      // Get the appropriate provider client
      const client = ProviderClientFactory.getClient(provider.type);

      // Parse config and tags
      const config = JSON.parse(provider.configJson);
      const tags = JSON.parse(memoryItem.tagsJson);

      // Call the provider client to sync
      const result = await client.syncMemory({
        key: memoryItem.key,
        content: memoryItem.content,
        tags,
        config,
      });

      // Update status based on result
      await this.prisma.memorySyncStatus.update({
        where: { id },
        data: {
          status: 'SUCCESS',
          lastSyncedAt: new Date(),
          metaJson: JSON.stringify({
            syncedAt: new Date().toISOString(),
            providerResponse: result,
          }),
        },
      });

      console.log(
        `Successfully synced memory "${memoryItem.key}" to provider "${provider.name}"`
      );
    } catch (error: any) {
      console.error(
        `Failed to sync memory "${memoryItem.key}" to provider "${provider.name}":`,
        error.message
      );

      // Mark as failed
      await this.prisma.memorySyncStatus.update({
        where: { id },
        data: {
          status: 'FAILED',
          metaJson: JSON.stringify({
            error: error.message,
            errorStack: error.stack,
            failedAt: new Date().toISOString(),
          }),
        },
      });
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const statuses = await this.prisma.memorySyncStatus.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      isSyncing: this.isSyncing,
      statuses: statuses.reduce((acc, s) => {
        acc[s.status.toLowerCase()] = s._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
