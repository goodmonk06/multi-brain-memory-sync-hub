#!/usr/bin/env node

import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';
import { SyncService } from '../services/sync.service';

const prisma = new PrismaClient();
const program = new Command();

program
  .name('memory-sync-cli')
  .description('CLI tool for managing the Memory Sync Hub')
  .version('1.0.0');

// Memory commands
const memory = program.command('memory').description('Manage memory items');

memory
  .command('list')
  .description('List all memory items')
  .option('-c, --category <category>', 'Filter by category')
  .option('-a, --archived', 'Include archived memories')
  .action(async (options) => {
    const where: any = {};
    if (options.category) where.category = options.category;
    if (!options.archived) where.archived = false;

    const memories = await prisma.memoryItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    console.table(
      memories.map((m) => ({
        Key: m.key,
        Category: m.category || '-',
        Archived: m.archived ? 'Yes' : 'No',
        Updated: m.updatedAt.toISOString().split('T')[0],
      }))
    );

    await prisma.$disconnect();
  });

memory
  .command('get <key>')
  .description('Get a specific memory by key')
  .action(async (key: string) => {
    const memory = await prisma.memoryItem.findUnique({
      where: { key },
      include: {
        syncStatuses: {
          include: { provider: true },
        },
      },
    });

    if (!memory) {
      console.error(`Memory with key "${key}" not found`);
      process.exit(1);
    }

    console.log('\nMemory Details:');
    console.log('==============');
    console.log(`Key: ${memory.key}`);
    console.log(`Content: ${memory.content}`);
    console.log(`Category: ${memory.category || '-'}`);
    console.log(`Priority: ${memory.priority}`);
    console.log(`Archived: ${memory.archived ? 'Yes' : 'No'}`);
    console.log(`\nSync Status:`);

    memory.syncStatuses.forEach((s) => {
      console.log(`  - ${s.provider.name}: ${s.status}`);
    });

    await prisma.$disconnect();
  });

memory
  .command('archive <key>')
  .description('Archive a memory')
  .action(async (key: string) => {
    await prisma.memoryItem.update({
      where: { key },
      data: { archived: true },
    });

    console.log(`Memory "${key}" archived successfully`);
    await prisma.$disconnect();
  });

// Provider commands
const provider = program.command('provider').description('Manage providers');

provider
  .command('list')
  .description('List all providers')
  .action(async () => {
    const providers = await prisma.provider.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { syncStatuses: true },
        },
      },
    });

    console.table(
      providers.map((p) => ({
        Name: p.name,
        Type: p.type,
        Enabled: p.enabled ? 'Yes' : 'No',
        Priority: p.priority,
        'Sync Count': p._count.syncStatuses,
      }))
    );

    await prisma.$disconnect();
  });

provider
  .command('enable <name>')
  .description('Enable a provider')
  .action(async (name: string) => {
    await prisma.provider.update({
      where: { name },
      data: { enabled: true },
    });

    console.log(`Provider "${name}" enabled`);
    await prisma.$disconnect();
  });

provider
  .command('disable <name>')
  .description('Disable a provider')
  .action(async (name: string) => {
    await prisma.provider.update({
      where: { name },
      data: { enabled: false },
    });

    console.log(`Provider "${name}" disabled`);
    await prisma.$disconnect();
  });

// Sync commands
const sync = program.command('sync').description('Manage synchronization');

sync
  .command('status')
  .description('Show sync status overview')
  .action(async () => {
    const statuses = await prisma.memorySyncStatus.groupBy({
      by: ['status'],
      _count: true,
    });

    console.log('\nSync Status Overview:');
    console.log('====================');
    statuses.forEach((s) => {
      console.log(`${s.status}: ${s._count}`);
    });

    await prisma.$disconnect();
  });

sync
  .command('trigger')
  .description('Trigger immediate sync')
  .action(async () => {
    const syncService = new SyncService(prisma);
    console.log('Triggering sync...');
    syncService.triggerSync();

    // Wait a bit to see results
    setTimeout(async () => {
      console.log('Sync triggered successfully');
      await prisma.$disconnect();
      process.exit(0);
    }, 2000);
  });

sync
  .command('retry-failed')
  .description('Retry all failed syncs')
  .action(async () => {
    const result = await prisma.memorySyncStatus.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING' },
    });

    console.log(`Reset ${result.count} failed syncs to PENDING`);
    await prisma.$disconnect();
  });

// Template commands
const template = program.command('template').description('Manage templates');

template
  .command('list')
  .description('List all templates')
  .action(async () => {
    const templates = await prisma.memoryTemplate.findMany({
      orderBy: { usageCount: 'desc' },
      include: {
        _count: {
          select: { memories: true },
        },
      },
    });

    console.table(
      templates.map((t) => ({
        Name: t.name,
        Category: t.category || '-',
        Public: t.isPublic ? 'Yes' : 'No',
        'Usage Count': t.usageCount,
        Instances: t._count.memories,
      }))
    );

    await prisma.$disconnect();
  });

// Health check
program
  .command('health')
  .description('Check system health')
  .action(async () => {
    console.log('Checking system health...\n');

    try {
      // Check database
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database: Connected');

      // Check memory count
      const memoryCount = await prisma.memoryItem.count();
      console.log(`✅ Memories: ${memoryCount} items`);

      // Check provider count
      const providerCount = await prisma.provider.count({ where: { enabled: true } });
      console.log(`✅ Providers: ${providerCount} enabled`);

      // Check pending syncs
      const pendingSyncs = await prisma.memorySyncStatus.count({ where: { status: 'PENDING' } });
      console.log(`⏳ Pending syncs: ${pendingSyncs}`);

      // Check failed syncs
      const failedSyncs = await prisma.memorySyncStatus.count({ where: { status: 'FAILED' } });
      if (failedSyncs > 0) {
        console.log(`⚠️  Failed syncs: ${failedSyncs}`);
      } else {
        console.log(`✅ Failed syncs: 0`);
      }

      console.log('\n✅ System is healthy');
    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Stats command
program
  .command('stats')
  .description('Show system statistics')
  .action(async () => {
    console.log('System Statistics');
    console.log('=================\n');

    const [
      memoryCount,
      templateCount,
      providerCount,
      syncCount,
      tagCount,
      collectionCount,
    ] = await Promise.all([
      prisma.memoryItem.count(),
      prisma.memoryTemplate.count(),
      prisma.provider.count(),
      prisma.memorySyncStatus.count(),
      prisma.tag.count(),
      prisma.memoryCollection.count(),
    ]);

    console.log(`Memories: ${memoryCount}`);
    console.log(`Templates: ${templateCount}`);
    console.log(`Providers: ${providerCount}`);
    console.log(`Sync Statuses: ${syncCount}`);
    console.log(`Tags: ${tagCount}`);
    console.log(`Collections: ${collectionCount}`);

    await prisma.$disconnect();
  });

// Parse and execute
program.parse(process.argv);
