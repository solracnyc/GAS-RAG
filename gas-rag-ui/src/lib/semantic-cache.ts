import { cosineSimilarity } from './embeddings';
import type { SearchResult } from './supabase-client';

interface CacheEntry {
  query: string;
  embedding: number[];
  result: SearchResult;
  timestamp: number;
  hits: number;
}

export class SemanticCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number;
  private similarityThreshold: number;

  constructor(options: {
    maxSize?: number;
    ttl?: number;
    similarityThreshold?: number;
  } = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300000'); // 5 minutes default
    this.similarityThreshold = options.similarityThreshold || parseFloat(process.env.NEXT_PUBLIC_CACHE_SIMILARITY_THRESHOLD || '0.95');
  }

  // Check if a semantically similar query exists in cache
  async check(query: string, queryEmbedding: number[]): Promise<SearchResult | null> {
    const now = Date.now();
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    // Clean expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }

    // Find best matching cached query
    for (const entry of this.cache.values()) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity >= this.similarityThreshold && similarity > bestSimilarity) {
        bestMatch = entry;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      // Update hit count
      bestMatch.hits++;

      console.log(`Cache hit! Similarity: ${(bestSimilarity * 100).toFixed(2)}% for query: "${query}"`);

      // Return cached result with updated metadata
      return {
        ...bestMatch.result,
        fromCache: true,
        latency: 0, // Instant from cache
      };
    }

    return null;
  }

  // Add a new query and result to cache
  async set(query: string, queryEmbedding: number[], result: SearchResult): Promise<void> {
    // Enforce max size by removing least recently used
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.findLRU();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    const cacheKey = this.generateCacheKey(query);

    this.cache.set(cacheKey, {
      query,
      embedding: queryEmbedding,
      result,
      timestamp: Date.now(),
      hits: 0,
    });

    console.log(`Cached query: "${query}" (Cache size: ${this.cache.size}/${this.maxSize})`);
  }

  // Find least recently used entry
  private findLRU(): string | null {
    let lruKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        lruKey = key;
      }
    }

    return lruKey;
  }

  // Generate a cache key for a query
  private generateCacheKey(query: string): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    similarityThreshold: number;
    totalHits: number;
    entries: Array<{ query: string; hits: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.values()).map(entry => ({
      query: entry.query,
      hits: entry.hits,
      age: now - entry.timestamp,
    }));

    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      similarityThreshold: this.similarityThreshold,
      totalHits,
      entries: entries.sort((a, b) => b.hits - a.hits), // Sort by hit count
    };
  }

  // Clear the cache
  clear(): void {
    this.cache.clear();
    console.log('Semantic cache cleared');
  }

  // Preload cache with common queries
  async preload(entries: Array<{ query: string; embedding: number[]; result: SearchResult }>): Promise<void> {
    for (const entry of entries) {
      const cacheKey = this.generateCacheKey(entry.query);
      this.cache.set(cacheKey, {
        ...entry,
        timestamp: Date.now(),
        hits: 0,
      });
    }
    console.log(`Preloaded ${entries.length} entries into cache`);
  }
}

// Singleton instance
let cacheInstance: SemanticCache | null = null;

export function getSemanticCache(): SemanticCache {
  if (!cacheInstance) {
    cacheInstance = new SemanticCache();
  }
  return cacheInstance;
}