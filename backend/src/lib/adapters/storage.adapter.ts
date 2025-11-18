import { logger } from '../logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface StorageObject {
  key: string;
  content: Buffer | string;
  contentType?: string;
  metadata?: Record<string, any>;
}

export interface IStorageAdapter {
  put(object: StorageObject): Promise<string>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

/**
 * Local file system storage adapter
 */
export class LocalFileStorageAdapter implements IStorageAdapter {
  constructor(private basePath: string) {}

  async put(object: StorageObject): Promise<string> {
    const fullPath = path.join(this.basePath, object.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const content = Buffer.isBuffer(object.content) ? object.content : Buffer.from(object.content);
    await fs.writeFile(fullPath, content);

    // Store metadata in sidecar file
    if (object.metadata) {
      await fs.writeFile(
        `${fullPath}.meta.json`,
        JSON.stringify({ contentType: object.contentType, ...object.metadata })
      );
    }

    logger.debug({ key: object.key }, 'Object stored in local filesystem');
    return fullPath;
  }

  async get(key: string): Promise<StorageObject | null> {
    const fullPath = path.join(this.basePath, key);

    try {
      const content = await fs.readFile(fullPath);

      let metadata: any = {};
      try {
        const metaContent = await fs.readFile(`${fullPath}.meta.json`, 'utf-8');
        metadata = JSON.parse(metaContent);
      } catch {
        // No metadata file
      }

      return {
        key,
        content,
        contentType: metadata.contentType,
        metadata,
      };
    } catch (error) {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.unlink(fullPath);
      try {
        await fs.unlink(`${fullPath}.meta.json`);
      } catch {
        // Ignore if no metadata file
      }
      logger.debug({ key }, 'Object deleted from local filesystem');
    } catch (error) {
      logger.warn({ key, err: error }, 'Failed to delete object');
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const searchPath = prefix ? path.join(this.basePath, prefix) : this.basePath;

    try {
      const files = await this.listFilesRecursive(searchPath);
      return files
        .filter((f) => !f.endsWith('.meta.json'))
        .map((f) => path.relative(this.basePath, f));
    } catch {
      return [];
    }
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          return entry.isDirectory() ? this.listFilesRecursive(fullPath) : [fullPath];
        })
      );
      return files.flat();
    } catch {
      return [];
    }
  }
}

/**
 * In-memory storage adapter (for testing)
 */
export class InMemoryStorageAdapter implements IStorageAdapter {
  private storage: Map<string, StorageObject> = new Map();

  async put(object: StorageObject): Promise<string> {
    this.storage.set(object.key, {
      ...object,
      content: Buffer.isBuffer(object.content) ? object.content : Buffer.from(object.content),
    });
    logger.debug({ key: object.key }, 'Object stored in memory');
    return object.key;
  }

  async get(key: string): Promise<StorageObject | null> {
    return this.storage.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  clear() {
    this.storage.clear();
  }
}

// Default adapter
export const storageAdapter: IStorageAdapter = new InMemoryStorageAdapter();
