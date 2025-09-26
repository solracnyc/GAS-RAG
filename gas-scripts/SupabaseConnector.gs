/**
 * Supabase Connector for Google Apps Script
 * Bridges GAS with Supabase pgvector database
 */

class SupabaseConnector {
  constructor(url, key) {
    if (!url || !key) {
      throw new Error('Supabase URL and key are required');
    }

    this.baseUrl = url;
    this.apiKey = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /**
   * Search for similar vectors
   */
  searchVectors(queryEmbedding, options = {}) {
    const {
      matchThreshold = 0.8,
      matchCount = 10
    } = options;

    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/rest/v1/rpc/match_documents`, {
        method: 'POST',
        headers: this.headers,
        payload: JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount
        }),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode === 200) {
        return JSON.parse(responseText);
      } else {
        console.error(`Search failed: ${responseCode} - ${responseText}`);
        throw new Error(`Search failed: ${responseText}`);
      }
    } catch (error) {
      console.error('Vector search error:', error.toString());
      throw error;
    }
  }

  /**
   * Hybrid search combining vector and text search
   */
  hybridSearch(queryText, queryEmbedding, options = {}) {
    const {
      matchThreshold = 0.7,
      matchCount = 10,
      vectorWeight = 0.7,
      textWeight = 0.3
    } = options;

    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/rest/v1/rpc/hybrid_search`, {
        method: 'POST',
        headers: this.headers,
        payload: JSON.stringify({
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
          vector_weight: vectorWeight,
          text_weight: textWeight
        }),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      } else {
        throw new Error(`Hybrid search failed: ${response.getContentText()}`);
      }
    } catch (error) {
      console.error('Hybrid search error:', error.toString());
      throw error;
    }
  }

  /**
   * Insert a single embedding
   */
  insertEmbedding(data) {
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/rest/v1/document_chunks`, {
        method: 'POST',
        headers: this.headers,
        payload: JSON.stringify(data),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 201) {
        return JSON.parse(response.getContentText());
      } else {
        throw new Error(`Insert failed: ${response.getContentText()}`);
      }
    } catch (error) {
      console.error('Insert error:', error.toString());
      throw error;
    }
  }

  /**
   * Batch insert multiple embeddings
   */
  batchInsertEmbeddings(dataArray) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process in smaller batches to avoid timeout
    const batchSize = 25;
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);

      try {
        const response = UrlFetchApp.fetch(`${this.baseUrl}/rest/v1/document_chunks`, {
          method: 'POST',
          headers: this.headers,
          payload: JSON.stringify(batch),
          muteHttpExceptions: true
        });

        if (response.getResponseCode() === 201) {
          results.successful += batch.length;
        } else {
          results.failed += batch.length;
          results.errors.push({
            batch: Math.floor(i / batchSize) + 1,
            error: response.getContentText()
          });
        }
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.toString()
        });
      }

      // Rate limiting
      Utilities.sleep(100);
    }

    return results;
  }

  /**
   * Get document by ID
   */
  getDocumentById(documentId) {
    try {
      const response = UrlFetchApp.fetch(
        `${this.baseUrl}/rest/v1/document_chunks?document_id=eq.${documentId}&order=chunk_index`,
        {
          method: 'GET',
          headers: this.headers,
          muteHttpExceptions: true
        }
      );

      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      } else {
        throw new Error(`Get document failed: ${response.getContentText()}`);
      }
    } catch (error) {
      console.error('Get document error:', error.toString());
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getDatabaseStats() {
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/rest/v1/rpc/get_database_stats`, {
        method: 'POST',
        headers: this.headers,
        payload: JSON.stringify({}),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        const stats = JSON.parse(response.getContentText());
        return stats[0] || {};
      } else {
        throw new Error(`Get stats failed: ${response.getContentText()}`);
      }
    } catch (error) {
      console.error('Get stats error:', error.toString());
      return {
        total_documents: 0,
        total_chunks: 0,
        error: error.toString()
      };
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    try {
      const startTime = new Date().getTime();

      const response = UrlFetchApp.fetch(
        `${this.baseUrl}/rest/v1/document_chunks?select=id&limit=1`,
        {
          method: 'GET',
          headers: this.headers,
          muteHttpExceptions: true
        }
      );

      const latency = new Date().getTime() - startTime;

      if (response.getResponseCode() === 200) {
        return {
          status: latency < 1000 ? 'healthy' : 'degraded',
          latency: latency,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          error: response.getContentText(),
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.toString(),
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Initialize Supabase connector with credentials from Script Properties
 */
function getSupabaseConnector() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const supabaseUrl = scriptProperties.getProperty('SUPABASE_URL');
  const supabaseKey = scriptProperties.getProperty('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase credentials not configured. ' +
      'Please add SUPABASE_URL and SUPABASE_ANON_KEY to Script Properties.'
    );
  }

  return new SupabaseConnector(supabaseUrl, supabaseKey);
}

/**
 * Test Supabase connection
 */
function testSupabaseConnection() {
  try {
    const connector = getSupabaseConnector();
    const health = connector.healthCheck();

    console.log('Health check result:', JSON.stringify(health, null, 2));

    if (health.status === 'healthy') {
      const stats = connector.getDatabaseStats();
      console.log('Database stats:', JSON.stringify(stats, null, 2));
      return {
        success: true,
        health: health,
        stats: stats
      };
    } else {
      return {
        success: false,
        health: health
      };
    }
  } catch (error) {
    console.error('Connection test failed:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Example: Search for similar documents
 */
function searchSimilarDocuments(queryText) {
  try {
    const connector = getSupabaseConnector();

    // Generate embedding for query (using existing GAS function)
    const queryEmbedding = generateEmbedding(queryText, 'RETRIEVAL_QUERY');

    // Search for similar vectors
    const results = connector.searchVectors(queryEmbedding, {
      matchThreshold: 0.75,
      matchCount: 5
    });

    console.log(`Found ${results.length} similar documents`);
    return results;

  } catch (error) {
    console.error('Search failed:', error.toString());
    throw error;
  }
}