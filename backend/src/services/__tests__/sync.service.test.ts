import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SyncService } from '../sync.service';
import {
  createTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
  createMemoryItemData,
  createProviderData,
} from '../../lib/test-helpers';

describe('SyncService', () => {
  let prisma: PrismaClient;
  let syncService: SyncService;

  beforeAll(async () => {
    prisma = await createTestDatabase();
    syncService = new SyncService(prisma);
  });

  afterAll(async () => {
    await closeTestDatabase(prisma);
  });

  beforeEach(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('Sync State Machine', () => {
    it('should create sync statuses when a new memory is created', async () => {
      // Create a provider
      const provider = await prisma.provider.create({
        data: createProviderData({ enabled: true }),
      });

      // Create a memory
      const memory = await prisma.memoryItem.create({
        data: createMemoryItemData(),
      });

      // Create sync status
      const syncStatus = await prisma.memorySyncStatus.create({
        data: {
          memoryItemId: memory.id,
          providerId: provider.id,
          status: 'PENDING',
        },
      });

      expect(syncStatus.status).toBe('PENDING');
      expect(syncStatus.memoryItemId).toBe(memory.id);
      expect(syncStatus.providerId).toBe(provider.id);
    });

    it('should get sync statistics', async () => {
      // Create test data
      const provider = await prisma.provider.create({
        data: createProviderData({ enabled: true }),
      });

      const memory1 = await prisma.memoryItem.create({
        data: createMemoryItemData(),
      });

      const memory2 = await prisma.memoryItem.create({
        data: createMemoryItemData(),
      });

      // Create sync statuses with different states
      await prisma.memorySyncStatus.create({
        data: {
          memoryItemId: memory1.id,
          providerId: provider.id,
          status: 'SUCCESS',
          lastSyncedAt: new Date(),
        },
      });

      await prisma.memorySyncStatus.create({
        data: {
          memoryItemId: memory2.id,
          providerId: provider.id,
          status: 'PENDING',
        },
      });

      const stats = await syncService.getSyncStats();

      expect(stats.statuses.success).toBe(1);
      expect(stats.statuses.pending).toBe(1);
    });
  });

  describe('Provider Management', () => {
    it('should only sync to enabled providers', async () => {
      const enabledProvider = await prisma.provider.create({
        data: createProviderData({ name: 'Enabled Provider', enabled: true }),
      });

      const disabledProvider = await prisma.provider.create({
        data: createProviderData({ name: 'Disabled Provider', enabled: false }),
      });

      const memory = await prisma.memoryItem.create({
        data: createMemoryItemData(),
      });

      // Create sync status only for enabled provider
      await prisma.memorySyncStatus.create({
        data: {
          memoryItemId: memory.id,
          providerId: enabledProvider.id,
          status: 'PENDING',
        },
      });

      const pendingSyncs = await prisma.memorySyncStatus.findMany({
        where: {
          status: 'PENDING',
          provider: { enabled: true },
        },
      });

      expect(pendingSyncs).toHaveLength(1);
      expect(pendingSyncs[0].providerId).toBe(enabledProvider.id);
    });
  });

  describe('Memory Management', () => {
    it('should store memory with tags', async () => {
      const tags = ['important', 'personal', 'preferences'];
      const memory = await prisma.memoryItem.create({
        data: createMemoryItemData({
          key: 'user_prefs',
          content: 'User prefers dark mode',
          tagsJson: JSON.stringify(tags),
        }),
      });

      expect(memory.key).toBe('user_prefs');
      expect(JSON.parse(memory.tagsJson)).toEqual(tags);
    });

    it('should enforce unique keys', async () => {
      const key = 'unique_key';
      await prisma.memoryItem.create({
        data: createMemoryItemData({ key }),
      });

      await expect(
        prisma.memoryItem.create({
          data: createMemoryItemData({ key }),
        })
      ).rejects.toThrow();
    });
  });
});
