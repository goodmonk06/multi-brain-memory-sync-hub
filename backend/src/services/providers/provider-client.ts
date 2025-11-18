/**
 * Base interface for provider clients
 */
export interface ProviderClient {
  syncMemory(params: SyncMemoryParams): Promise<SyncResult>;
}

export interface SyncMemoryParams {
  key: string;
  content: string;
  tags: string[];
  config: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  externalId?: string;
  metadata?: Record<string, any>;
}

/**
 * Factory for creating provider clients
 */
export class ProviderClientFactory {
  private static clients: Map<string, ProviderClient> = new Map();

  static getClient(providerType: string): ProviderClient {
    if (!this.clients.has(providerType)) {
      // Lazy load client based on type
      switch (providerType) {
        case 'OPENAI':
          const { OpenAIClient } = require('./openai.client');
          this.clients.set(providerType, new OpenAIClient());
          break;
        case 'ANTHROPIC':
          const { AnthropicClient } = require('./anthropic.client');
          this.clients.set(providerType, new AnthropicClient());
          break;
        case 'GOOGLE':
          const { GoogleClient } = require('./google.client');
          this.clients.set(providerType, new GoogleClient());
          break;
        default:
          const { DefaultClient } = require('./default.client');
          this.clients.set(providerType, new DefaultClient());
      }
    }

    return this.clients.get(providerType)!;
  }
}
