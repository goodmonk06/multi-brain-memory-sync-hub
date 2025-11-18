import { logger } from '../logger';

export interface SearchDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  highlights?: string[];
  metadata?: Record<string, any>;
}

export interface ISearchAdapter {
  index(document: SearchDocument): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}

/**
 * In-memory search adapter with simple text matching
 */
export class InMemorySearchAdapter implements ISearchAdapter {
  private documents: Map<string, SearchDocument> = new Map();

  async index(document: SearchDocument): Promise<void> {
    this.documents.set(document.id, document);
    logger.debug({ documentId: document.id }, 'Document indexed');
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const searchTerm = query.query.toLowerCase();
    const results: SearchResult[] = [];

    for (const [id, doc] of this.documents.entries()) {
      const content = doc.content.toLowerCase();
      const score = this.calculateScore(content, searchTerm);

      if (score > 0) {
        results.push({
          id,
          score,
          highlights: this.extractHighlights(doc.content, searchTerm),
          metadata: doc.metadata,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    return results.slice(offset, offset + limit);
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
    logger.debug({ documentId: id }, 'Document removed from index');
  }

  clear() {
    this.documents.clear();
  }

  private calculateScore(content: string, searchTerm: string): number {
    if (!searchTerm) return 0;

    const words = searchTerm.split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (content.includes(word)) {
        // Count occurrences
        const regex = new RegExp(word, 'gi');
        const matches = content.match(regex);
        score += (matches?.length || 0) * 10;

        // Bonus for exact phrase
        if (content.includes(searchTerm)) {
          score += 50;
        }

        // Bonus for word at start
        if (content.startsWith(word)) {
          score += 20;
        }
      }
    }

    return score;
  }

  private extractHighlights(content: string, searchTerm: string): string[] {
    const words = searchTerm.toLowerCase().split(/\s+/);
    const highlights: string[] = [];

    for (const word of words) {
      const regex = new RegExp(`(.{0,50}${word}.{0,50})`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches.slice(0, 3));
      }
    }

    return highlights;
  }
}

// Default adapter
export const searchAdapter: ISearchAdapter = new InMemorySearchAdapter();
