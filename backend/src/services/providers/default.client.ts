import { ProviderClient, SyncMemoryParams, SyncResult } from './provider-client';

/**
 * Default stub client for unknown provider types
 *
 * This serves as a fallback for custom or future providers.
 */
export class DefaultClient implements ProviderClient {
  async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
    const { key, content, tags } = params;

    // Simulate API call delay
    await this.sleep(300 + Math.random() * 400);

    console.log(`[Default Stub] Syncing memory: ${key}`);
    console.log(`[Default Stub] Content: ${content.substring(0, 50)}...`);
    console.log(`[Default Stub] Tags: ${tags.join(', ')}`);

    return {
      success: true,
      message: 'Memory synced to generic provider (stub)',
      externalId: `default_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        provider: 'default',
        timestamp: new Date().toISOString(),
        stub: true,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
