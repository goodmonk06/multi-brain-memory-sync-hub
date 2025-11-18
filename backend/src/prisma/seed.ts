import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.memorySyncStatus.deleteMany();
  await prisma.memoryItem.deleteMany();
  await prisma.provider.deleteMany();

  // Create providers
  console.log('Creating providers...');
  const providers = await Promise.all([
    prisma.provider.create({
      data: {
        name: 'ChatGPT',
        type: 'OPENAI',
        configJson: JSON.stringify({
          apiKey: 'sk-fake-key-for-testing',
          model: 'gpt-4',
          organizationId: 'org-fake',
        }),
        enabled: true,
      },
    }),
    prisma.provider.create({
      data: {
        name: 'Claude',
        type: 'ANTHROPIC',
        configJson: JSON.stringify({
          apiKey: 'sk-ant-fake-key-for-testing',
          model: 'claude-3-5-sonnet-20241022',
        }),
        enabled: true,
      },
    }),
    prisma.provider.create({
      data: {
        name: 'Gemini',
        type: 'GOOGLE',
        configJson: JSON.stringify({
          apiKey: 'AIza-fake-key-for-testing',
          model: 'gemini-pro',
        }),
        enabled: true,
      },
    }),
    prisma.provider.create({
      data: {
        name: 'Perplexity',
        type: 'OTHER',
        configJson: JSON.stringify({
          apiKey: 'pplx-fake-key-for-testing',
          model: 'llama-3.1-sonar-large-128k-online',
        }),
        enabled: false, // Disabled by default
      },
    }),
  ]);

  console.log(`Created ${providers.length} providers`);

  // Create memory items
  console.log('Creating memory items...');
  const memoryItems = await Promise.all([
    prisma.memoryItem.create({
      data: {
        key: 'user_preferences',
        content: 'User prefers concise responses with code examples. Avoid verbose explanations.',
        tagsJson: JSON.stringify(['preferences', 'communication']),
      },
    }),
    prisma.memoryItem.create({
      data: {
        key: 'tech_stack',
        content: 'Primary stack: TypeScript, React, Node.js, PostgreSQL. Prefers functional programming patterns.',
        tagsJson: JSON.stringify(['technical', 'stack']),
      },
    }),
    prisma.memoryItem.create({
      data: {
        key: 'meeting_schedule',
        content: 'Weekly team sync every Monday at 10 AM EST. Stand-ups daily at 9:30 AM.',
        tagsJson: JSON.stringify(['schedule', 'meetings']),
      },
    }),
    prisma.memoryItem.create({
      data: {
        key: 'project_context',
        content: 'Currently working on a multi-brain memory sync hub to keep LLM contexts synchronized across providers.',
        tagsJson: JSON.stringify(['project', 'context']),
      },
    }),
    prisma.memoryItem.create({
      data: {
        key: 'code_style',
        content: 'Follow Airbnb style guide. Use ESLint and Prettier. Maximum line length 100 chars. Prefer arrow functions.',
        tagsJson: JSON.stringify(['coding', 'style']),
      },
    }),
    prisma.memoryItem.create({
      data: {
        key: 'personal_info',
        content: 'Working remotely from San Francisco. Timezone: PST. Available 9 AM - 6 PM weekdays.',
        tagsJson: JSON.stringify(['personal', 'availability']),
      },
    }),
  ]);

  console.log(`Created ${memoryItems.length} memory items`);

  // Create sync statuses for enabled providers
  console.log('Creating sync statuses...');
  const enabledProviders = providers.filter((p) => p.enabled);

  let syncStatusCount = 0;
  for (const memory of memoryItems) {
    for (const provider of enabledProviders) {
      await prisma.memorySyncStatus.create({
        data: {
          memoryItemId: memory.id,
          providerId: provider.id,
          status: 'PENDING',
        },
      });
      syncStatusCount++;
    }
  }

  console.log(`Created ${syncStatusCount} sync statuses`);

  // Summary
  console.log('\n✅ Seed completed successfully!');
  console.log(`
Summary:
- ${providers.length} providers (${enabledProviders.length} enabled)
- ${memoryItems.length} memory items
- ${syncStatusCount} sync statuses (pending sync)

The sync service will automatically process these when the server starts.
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
