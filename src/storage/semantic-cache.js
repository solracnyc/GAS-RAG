/**
 * Semantic Cache for Vector Search Optimization
 * Reduces database queries by caching semantically similar queries
 */

class SemanticCache {
  constructor(options = {}) {
    // Configuration
    this.config = {
      similarityThreshold: options.similarityThreshold || 0.95,
      maxCacheSize: options.maxCacheSize || 100,
      ttl: options.ttl || 300000, // 5 minutes default
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      enablePersistence: options.enablePersistence || false,
      persistencePath: options.persistencePath || '.semantic_cache.json'
    };

    // Cache storage
    this.cache = new Map();
    this.embeddings = new Map();
    this.accessCounts = new Map();

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalQueries: 0,
      averageSimilarity: 0
    };

    // Start cleanup interval
    if (this.config.cleanupInterval > 0) {
      this.startCleanupInterval();
    }

    // Load persisted cache if enabled
    if (this.config.enablePersistence) {
      this.loadPersistedCache();
    }
  }

  /**
   * Get cached result for similar query
   */
  async get(queryEmbedding, queryText = null) {
    this.stats.totalQueries++;

    // Find most similar cached embedding
    const match = this.findSimilarCached(queryEmbedding);

    if (match && match.similarity >= this.config.similarityThreshold) {
      const cachedData = this.cache.get(match.key);

      if (cachedData && !this.isExpired(cachedData)) {
        // Update access count and timestamp
        this.accessCounts.set(match.key, (this.accessCounts.get(match.key) || 0) + 1);
        cachedData.lastAccessed = Date.now();

        this.stats.hits++;
        this.stats.averageSimilarity =
          (this.stats.averageSimilarity * (this.stats.hits - 1) + match.similarity) / this.stats.hits;

        console.log(`Cache hit! Similarity: ${match.similarity.toFixed(4)}`);

        return {
          data: cachedData.result,
          cached: true,
          similarity: match.similarity,
          originalQuery: cachedData.queryText
        };
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store result in cache
   */
  set(queryEmbedding, result, queryText = null, ttl = null) {
    // Generate cache key
    const key = this.generateKey(queryEmbedding);

    // Check cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLRU();
    }

    // Store in cache
    this.cache.set(key, {
      result: result,
      queryText: queryText,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      ttl: ttl || this.config.ttl
    });

    this.embeddings.set(key, queryEmbedding);
    this.accessCounts.set(key, 0);

    // Persist if enabled
    if (this.config.enablePersistence) {
      this.persistCache();
    }

    console.log(`Cached result for query: ${queryText ? queryText.substring(0, 50) + '...' : key}`);
  }

  /**
   * Find similar cached embedding
   */
  findSimilarCached(queryEmbedding) {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [key, cachedEmbedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, cachedEmbedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = key;
      }
    }

    return bestMatch ? {
      key: bestMatch,
      similarity: bestSimilarity
    } : null;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(cachedData) {
    const age = Date.now() - cachedData.timestamp;
    return age > cachedData.ttl;
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let lruKey = null;
    let lruTime = Date.now();

    for (const [key, data] of this.cache) {
      if (data.lastAccessed < lruTime) {
        lruTime = data.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.remove(lruKey);
      this.stats.evictions++;
      console.log(`Evicted LRU cache entry: ${lruKey}`);
    }
  }

  /**
   * Remove entry from cache
   */
  remove(key) {
    this.cache.delete(key);
    this.embeddings.delete(key);
    this.accessCounts.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.embeddings.clear();
    this.accessCounts.clear();
    console.log(`Cleared ${size} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalQueries > 0
      ? (this.stats.hits / this.stats.totalQueries * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.config.maxCacheSize,
      ttl: `${this.config.ttl / 1000}s`,
      similarityThreshold: this.config.similarityThreshold
    };
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    let removed = 0;
    const now = Date.now();

    for (const [key, data] of this.cache) {
      if (this.isExpired(data)) {
        this.remove(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Generate cache key from embedding
   */
  generateKey(embedding) {
    // Use first and last few values as key
    const prefix = embedding.slice(0, 5).map(v => v.toFixed(4)).join(',');
    const suffix = embedding.slice(-5).map(v => v.toFixed(4)).join(',');
    return `${prefix}_${suffix}`;
  }

  /**
   * Persist cache to disk
   */
  async persistCache() {
    if (!this.config.enablePersistence) return;

    try {
      const fs = require('fs').promises;
      const data = {
        cache: Array.from(this.cache.entries()),
        embeddings: Array.from(this.embeddings.entries()),
        accessCounts: Array.from(this.accessCounts.entries()),
        stats: this.stats,
        timestamp: Date.now()
      };

      await fs.writeFile(
        this.config.persistencePath,
        JSON.stringify(data, null, 2)
      );

    } catch (error) {
      console.error('Failed to persist cache:', error.message);
    }
  }

  /**
   * Load persisted cache from disk
   */
  async loadPersistedCache() {
    if (!this.config.enablePersistence) return;

    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(this.config.persistencePath, 'utf8');
      const data = JSON.parse(content);

      // Check if cache is not too old (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        console.log('Persisted cache is too old, ignoring');
        return;
      }

      // Restore cache
      this.cache = new Map(data.cache);
      this.embeddings = new Map(data.embeddings);
      this.accessCounts = new Map(data.accessCounts);
      this.stats = data.stats;

      // Clean up expired entries
      this.cleanup();

      console.log(`Loaded ${this.cache.size} entries from persisted cache`);

    } catch (error) {
      // Cache file doesn't exist or is corrupted
      console.log('No valid persisted cache found');
    }
  }

  /**
   * Get cache entry details
   */
  getEntryDetails(key) {
    const cachedData = this.cache.get(key);
    const embedding = this.embeddings.get(key);
    const accessCount = this.accessCounts.get(key);

    if (!cachedData) return null;

    return {
      key: key,
      queryText: cachedData.queryText,
      timestamp: new Date(cachedData.timestamp).toISOString(),
      lastAccessed: new Date(cachedData.lastAccessed).toISOString(),
      accessCount: accessCount,
      ttl: cachedData.ttl,
      expired: this.isExpired(cachedData),
      embeddingDimensions: embedding ? embedding.length : 0
    };
  }

  /**
   * Get all cache entries
   */
  getAllEntries() {
    const entries = [];

    for (const key of this.cache.keys()) {
      const details = this.getEntryDetails(key);
      if (details) {
        entries.push(details);
      }
    }

    // Sort by access count (most accessed first)
    entries.sort((a, b) => b.accessCount - a.accessCount);

    return entries;
  }
}

/**
 * Factory function to create cache with Supabase integration
 */
function createSemanticCache(options = {}) {
  return new SemanticCache(options);
}

/**
 * Middleware for Express/Node.js applications
 */
function semanticCacheMiddleware(cache) {
  return async (req, res, next) => {
    if (req.method === 'POST' && req.body.embedding) {
      // Check cache
      const cached = await cache.get(req.body.embedding, req.body.query);

      if (cached) {
        return res.json({
          ...cached.data,
          cached: true,
          cacheHit: true,
          similarity: cached.similarity
        });
      }

      // Store original send method
      const originalSend = res.json.bind(res);

      // Override send to cache response
      res.json = function(data) {
        if (!data.error) {
          cache.set(req.body.embedding, data, req.body.query);
        }
        return originalSend(data);
      };
    }

    next();
  };
}

module.exports = {
  SemanticCache,
  createSemanticCache,
  semanticCacheMiddleware
};