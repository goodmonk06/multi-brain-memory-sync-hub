const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface MemoryItem {
  id: string;
  key: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  syncStatuses?: SyncStatus[];
}

export interface Provider {
  id: string;
  name: string;
  type: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OTHER';
  enabled: boolean;
  config: Record<string, any>;
  stats?: {
    total: number;
    pending: number;
    syncing: number;
    success: number;
    failed: number;
  };
}

export interface SyncStatus {
  id: string;
  status: 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  lastSyncedAt: string | null;
  updatedAt: string;
  meta: Record<string, any>;
  provider: Provider;
  memoryItem?: MemoryItem;
}

export interface SyncOverview {
  total: number;
  byStatus: {
    pending: number;
    syncing: number;
    success: number;
    failed: number;
  };
  byProvider: Record<string, {
    total: number;
    pending: number;
    syncing: number;
    success: number;
    failed: number;
  }>;
}

class ApiClient {
  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Memory API
  async getMemories(): Promise<MemoryItem[]> {
    return this.fetchJson<MemoryItem[]>('/api/memories');
  }

  async getMemory(id: string): Promise<MemoryItem> {
    return this.fetchJson<MemoryItem>(`/api/memories/${id}`);
  }

  async createMemory(data: { key: string; content: string; tags?: string[] }): Promise<MemoryItem> {
    return this.fetchJson<MemoryItem>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMemory(id: string, data: { content?: string; tags?: string[] }): Promise<MemoryItem> {
    return this.fetchJson<MemoryItem>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.fetchJson<void>(`/api/memories/${id}`, {
      method: 'DELETE',
    });
  }

  // Provider API
  async getProviders(): Promise<Provider[]> {
    return this.fetchJson<Provider[]>('/api/providers');
  }

  async getProvider(id: string): Promise<Provider> {
    return this.fetchJson<Provider>(`/api/providers/${id}`);
  }

  async createProvider(data: {
    name: string;
    type: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OTHER';
    config?: Record<string, any>;
    enabled?: boolean;
  }): Promise<Provider> {
    return this.fetchJson<Provider>('/api/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProvider(
    id: string,
    data: { name?: string; config?: Record<string, any>; enabled?: boolean }
  ): Promise<Provider> {
    return this.fetchJson<Provider>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProvider(id: string): Promise<void> {
    await this.fetchJson<void>(`/api/providers/${id}`, {
      method: 'DELETE',
    });
  }

  // Sync API
  async getSyncOverview(): Promise<SyncOverview> {
    return this.fetchJson<SyncOverview>('/api/sync/overview');
  }

  async getSyncStatuses(): Promise<SyncStatus[]> {
    return this.fetchJson<SyncStatus[]>('/api/sync/status');
  }

  async triggerSync(): Promise<{ message: string }> {
    return this.fetchJson<{ message: string }>('/api/sync/trigger', {
      method: 'POST',
    });
  }

  async retryFailedSyncs(): Promise<{ message: string; count: number }> {
    return this.fetchJson<{ message: string; count: number }>('/api/sync/retry-failed', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
