import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Test database URL
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/memory_sync_hub_test';

export async function createTestDatabase() {
  // Set test environment
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL,
      },
    },
  });

  // Run migrations
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'ignore',
    });
  } catch (error) {
    console.warn('Migration failed, trying db push instead');
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'ignore',
    });
  }

  return prisma;
}

export async function cleanupTestDatabase(prisma: PrismaClient) {
  // Delete all data
  await prisma.memorySyncStatus.deleteMany();
  await prisma.memoryItem.deleteMany();
  await prisma.provider.deleteMany();
}

export async function closeTestDatabase(prisma: PrismaClient) {
  await prisma.$disconnect();
}

// Factory functions for test data
export function createMemoryItemData(overrides: any = {}) {
  return {
    key: `test_memory_${Date.now()}_${Math.random()}`,
    content: 'Test memory content',
    tagsJson: JSON.stringify(['test', 'fixture']),
    ...overrides,
  };
}

export function createProviderData(overrides: any = {}) {
  return {
    name: `Test Provider ${Date.now()}_${Math.random()}`,
    type: 'OTHER' as const,
    configJson: JSON.stringify({ apiKey: 'test-key' }),
    enabled: true,
    ...overrides,
  };
}
