require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Custom error class for vector operations
 */
class VectorOperationError extends Error {
  constructor(message, operation, originalError = null, retryable = true) {
    super(message);
    this.name = 'VectorOperationError';
    this.operation = operation;
    this.originalError = originalError;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Supabase Vector Client with comprehensive error handling and retry logic
 */
class SupabaseVectorClient {
  constructor(url, key, options = {}) {
    if (!url || !key) {
      throw new Error('Supabase URL and key are required');
    }

    // Initialize Supabase client
    this.client = createClient(url, key, {
      db: { schema: options.schema || 'public' },
      global: {
        fetch: this.createFetchWithTimeout(options.timeout || 30000)
      }
    });

    // Configuration
    this.config = {
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 10000,
      batchSize: options.batchSize || 50,
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      similarityThreshold: options.similarityThreshold || 0.8
    };

    // Circuit breaker state
    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'closed', // closed, open, half-open
      threshold: options.circuitBreakerThreshold || 5,
      timeout: options.circuitBreakerTimeout || 60000 // 1 minute
    };

    // Cache for query results (if enabled)
    this.cache = this.config.cacheEnabled ? new Map() : null;

    // Statistics tracking
    this.stats = {
      queries: 0,
      inserts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalLatency: 0
    };
  }

  /**
   * Create fetch with timeout wrapper
   */
  createFetchWithTimeout(timeout) {
    return (url, options) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
    };
  }

  /**
   * Insert single or multiple vectors
   */
  async insertVectors(documents) {
    const operation = 'insertVectors';
    const startTime = Date.now();

    try {
      // Check circuit breaker
      this.checkCircuitBreaker(operation);

      // Ensure array format
      const docs = Array.isArray(documents) ? documents : [documents];

      // Validate documents
      this.validateDocuments(docs);

      // Process in batches
      const results = await this.processBatches(docs, 'insert');

      // Update stats
      this.stats.inserts += results.length;
      this.stats.totalLatency += Date.now() - startTime;

      return results;

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Update existing vectors
   */
  async updateVectors(documents) {
    const operation = 'updateVectors';

    try {
      this.checkCircuitBreaker(operation);

      const docs = Array.isArray(documents) ? documents : [documents];
      this.validateDocuments(docs);

      const results = await this.processBatches(docs, 'update');
      return results;

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(ids) {
    const operation = 'deleteVectors';

    try {
      this.checkCircuitBreaker(operation);

      const idArray = Array.isArray(ids) ? ids : [ids];

      const { data, error } = await this.withRetry(async () =>
        this.client
          .from('document_chunks')
          .delete()
          .in('id', idArray)
          .select('id')
      );

      if (error) throw error;
      return data;

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Similarity search with vector embedding
   */
  async similaritySearch(queryEmbedding, options = {}) {
    const operation = 'similaritySearch';
    const startTime = Date.now();

    try {
      this.checkCircuitBreaker(operation);

      // Validate embedding
      if (!this.validateEmbedding(queryEmbedding)) {
        throw new Error('Invalid query embedding');
      }

      // Check cache if enabled
      if (this.config.cacheEnabled) {
        const cached = await this.getCachedResult(queryEmbedding);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // Default options
      const searchOptions = {
        matchThreshold: options.matchThreshold || this.config.similarityThreshold,
        matchCount: options.matchCount || 10,
        filter: options.filter || {}
      };

      // Execute search
      const { data, error } = await this.withRetry(async () =>
        this.client.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: searchOptions.matchThreshold,
          match_count: searchOptions.matchCount
        })
      );

      if (error) throw error;

      // Apply additional filters if provided
      let results = data || [];
      if (Object.keys(searchOptions.filter).length > 0) {
        results = this.applyFilters(results, searchOptions.filter);
      }

      // Cache results if enabled
      if (this.config.cacheEnabled) {
        this.setCachedResult(queryEmbedding, results);
      }

      // Update stats
      this.stats.queries++;
      this.stats.totalLatency += Date.now() - startTime;

      return results;

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Hybrid search combining vector and text search
   */
  async hybridSearch(query, queryEmbedding, options = {}) {
    const operation = 'hybridSearch';

    try {
      this.checkCircuitBreaker(operation);

      if (!query || !queryEmbedding) {
        throw new Error('Both query text and embedding are required');
      }

      const searchOptions = {
        matchThreshold: options.matchThreshold || 0.7,
        matchCount: options.matchCount || 10,
        vectorWeight: options.vectorWeight || 0.7,
        textWeight: options.textWeight || 0.3
      };

      const { data, error } = await this.withRetry(async () =>
        this.client.rpc('hybrid_search', {
          query_text: query,
          query_embedding: queryEmbedding,
          match_threshold: searchOptions.matchThreshold,
          match_count: searchOptions.matchCount,
          vector_weight: searchOptions.vectorWeight,
          text_weight: searchOptions.textWeight
        })
      );

      if (error) throw error;

      this.stats.queries++;
      return data || [];

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Search by document ID
   */
  async getDocumentById(documentId) {
    const operation = 'getDocumentById';

    try {
      this.checkCircuitBreaker(operation);

      const { data, error } = await this.withRetry(async () =>
        this.client
          .from('document_chunks')
          .select('*')
          .eq('document_id', documentId)
          .order('chunk_index', { ascending: true })
      );

      if (error) throw error;
      return data;

    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error, operation);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const operation = 'getDatabaseStats';

    try {
      this.checkCircuitBreaker(operation);

      const { data, error } = await this.withRetry(async () =>
        this.client.rpc('get_database_stats')
      );

      if (error) throw error;

      return {
        ...data[0],
        clientStats: this.getClientStats()
      };

    } catch (error) {
      throw this.handleError(error, operation);
    }
  }

  /**
   * Process documents in batches
   */
  async processBatches(documents, operationType) {
    const results = [];
    const batches = this.createBatches(documents, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);

      try {
        let batchResult;

        if (operationType === 'insert') {
          const { data, error } = await this.withRetry(async () =>
            this.client
              .from('document_chunks')
              .upsert(batch, {
                onConflict: 'document_id,chunk_index'
              })
              .select('id')
          );

          if (error) throw error;
          batchResult = data;

        } else if (operationType === 'update') {
          const { data, error } = await this.withRetry(async () =>
            this.client
              .from('document_chunks')
              .upsert(batch, {
                onConflict: 'id',
                ignoreDuplicates: false
              })
              .select('id')
          );

          if (error) throw error;
          batchResult = data;
        }

        results.push(...(batchResult || []));

        // Rate limiting between batches
        if (i < batches.length - 1) {
          await this.sleep(100);
        }

      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error.message);
        throw error;
      }
    }

    return results;
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry(operation) {
    let lastError = null;
    let delay = this.config.retryDelay;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await operation();

        // Reset circuit breaker on success
        if (this.circuitBreaker.state === 'half-open') {
          this.circuitBreaker.state = 'closed';
          this.circuitBreaker.failureCount = 0;
        }

        return result;

      } catch (error) {
        lastError = error;

        // Update circuit breaker
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
          this.circuitBreaker.state = 'open';
        }

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === this.config.retryAttempts) {
          throw error;
        }

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);

        // Exponential backoff with jitter
        const jitter = Math.random() * 0.1 * delay;
        await this.sleep(delay + jitter);
        delay = Math.min(delay * 2, this.config.maxRetryDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check circuit breaker state
   */
  checkCircuitBreaker(operation) {
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;

      if (timeSinceLastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.failureCount = 0;
      } else {
        throw new VectorOperationError(
          'Circuit breaker is open - service temporarily unavailable',
          operation,
          null,
          false
        );
      }
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const nonRetryablePatterns = [
      /invalid.*api.*key/i,
      /permission.*denied/i,
      /invalid.*request/i,
      /quota.*exceeded/i,
      /invalid.*dimension/i,
      /constraint.*violation/i
    ];

    const errorMessage = error.message || error.toString();
    return !nonRetryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Handle and transform errors
   */
  handleError(error, operation) {
    if (error instanceof VectorOperationError) {
      return error;
    }

    const isRetryable = this.isRetryableError(error);
    return new VectorOperationError(
      `${operation} failed: ${error.message}`,
      operation,
      error,
      isRetryable
    );
  }

  /**
   * Validate documents before insertion
   */
  validateDocuments(documents) {
    documents.forEach((doc, index) => {
      if (!doc.chunk_content) {
        throw new Error(`Document ${index} missing required field: chunk_content`);
      }

      if (!doc.embedding || !this.validateEmbedding(doc.embedding)) {
        throw new Error(`Document ${index} has invalid embedding`);
      }

      if (!doc.document_id) {
        doc.document_id = `doc_${Date.now()}_${index}`;
      }

      if (doc.chunk_index === undefined) {
        doc.chunk_index = 0;
      }
    });
  }

  /**
   * Validate embedding array
   */
  validateEmbedding(embedding) {
    return (
      Array.isArray(embedding) &&
      embedding.length === 768 &&
      embedding.every(val => typeof val === 'number' && !isNaN(val))
    );
  }

  /**
   * Apply filters to results
   */
  applyFilters(results, filters) {
    return results.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (key.includes('.')) {
          // Handle nested properties in metadata
          const keys = key.split('.');
          let obj = item;
          for (const k of keys) {
            obj = obj?.[k];
          }
          return obj === value;
        }
        return item[key] === value || item.metadata?.[key] === value;
      });
    });
  }

  /**
   * Get cached result
   */
  async getCachedResult(queryEmbedding) {
    if (!this.cache) return null;

    const cacheKey = this.generateCacheKey(queryEmbedding);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Set cached result
   */
  setCachedResult(queryEmbedding, results) {
    if (!this.cache) return;

    const cacheKey = this.generateCacheKey(queryEmbedding);
    this.cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Generate cache key from embedding
   */
  generateCacheKey(embedding) {
    // Use first and last few values as a simple hash
    const prefix = embedding.slice(0, 5).join(',');
    const suffix = embedding.slice(-5).join(',');
    return `${prefix}_${suffix}`;
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get client statistics
   */
  getClientStats() {
    const avgLatency = this.stats.queries > 0
      ? Math.round(this.stats.totalLatency / this.stats.queries)
      : 0;

    const cacheHitRate = (this.stats.cacheHits + this.stats.cacheMisses) > 0
      ? ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(1)
      : 0;

    return {
      totalQueries: this.stats.queries,
      totalInserts: this.stats.inserts,
      totalErrors: this.stats.errors,
      averageLatency: `${avgLatency}ms`,
      cacheHitRate: `${cacheHitRate}%`,
      circuitBreakerState: this.circuitBreaker.state
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const startTime = Date.now();

    try {
      const { count, error } = await this.client
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const latency = Date.now() - startTime;

      return {
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency: `${latency}ms`,
        documentCount: count,
        circuitBreaker: this.circuitBreaker.state,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        circuitBreaker: this.circuitBreaker.state,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
      console.log('Cache cleared');
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      queries: 0,
      inserts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalLatency: 0
    };
  }

  /**
   * Helper: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SupabaseVectorClient;