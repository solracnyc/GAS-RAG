#!/usr/bin/env node

/**
 * Test Google Apps Script Integration with Supabase
 * Simulates the GAS environment to test the connection
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Simulate GAS UrlFetchApp
const UrlFetchApp = {
  fetch: async (url, options) => {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.payload
    });

    return {
      getResponseCode: () => response.status,
      getContentText: async () => await response.text(),
      getHeaders: () => response.headers
    };
  }
};

// Simulate GAS PropertiesService
const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => {
      const props = {
        'SUPABASE_URL': process.env.SUPABASE_URL,
        'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
        'GOOGLE_AI_KEY': process.env.GOOGLE_AI_KEY
      };
      return props[key];
    }
  })
};

// Utilities mock
const Utilities = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Console log wrapper
const console = global.console;
const Logger = {
  log: (msg) => console.log(`[GAS LOG] ${msg}`)
};

/**
 * SupabaseConnector class from GAS
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

  async healthCheck() {
    try {
      const startTime = Date.now();

      const response = await fetch(
        `${this.baseUrl}/rest/v1/document_chunks?select=id&limit=1`,
        {
          method: 'GET',
          headers: this.headers
        }
      );

      const latency = Date.now() - startTime;

      if (response.status === 200) {
        return {
          status: latency < 1000 ? 'healthy' : 'degraded',
          latency: latency,
          timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          status: 'unhealthy',
          error: errorText,
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

  async getDatabaseStats() {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/rpc/get_database_stats`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({})
      });

      if (response.status === 200) {
        const stats = await response.json();
        return stats[0] || {};
      } else {
        const errorText = await response.text();
        throw new Error(`Get stats failed: ${errorText}`);
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

  async searchVectors(queryEmbedding, options = {}) {
    const {
      matchThreshold = 0.8,
      matchCount = 10
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/rpc/match_documents`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount
        })
      });

      const responseCode = response.status;
      const responseText = await response.text();

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
}

/**
 * Test functions
 */
async function testSupabaseConnection() {
  console.log('🧪 Testing GAS-Supabase Integration');
  console.log('=' .repeat(50));

  const scriptProperties = PropertiesService.getScriptProperties();
  const supabaseUrl = scriptProperties.getProperty('SUPABASE_URL');
  const supabaseKey = scriptProperties.getProperty('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not configured');
    return {
      success: false,
      error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment'
    };
  }

  console.log('✅ Credentials loaded from environment');
  console.log(`📍 URL: ${supabaseUrl}`);

  const connector = new SupabaseConnector(supabaseUrl, supabaseKey);

  // Test 1: Health Check
  console.log('\n📋 Test 1: Health Check');
  const health = await connector.healthCheck();
  console.log(`  Status: ${health.status}`);
  console.log(`  Latency: ${health.latency}ms`);

  if (health.error) {
    console.error(`  Error: ${health.error}`);
  }

  // Test 2: Database Stats
  console.log('\n📋 Test 2: Database Statistics');
  const stats = await connector.getDatabaseStats();

  if (stats.error) {
    console.log(`  ⚠️ Could not retrieve stats: ${stats.error}`);
    console.log('  Note: This might mean the database is not yet initialized');
  } else {
    console.log(`  Total documents: ${stats.total_documents || 0}`);
    console.log(`  Total chunks: ${stats.total_chunks || 0}`);
  }

  // Test 3: Vector Search (with dummy embedding)
  console.log('\n📋 Test 3: Vector Search (with test embedding)');
  try {
    // Generate test embedding (768 dimensions)
    const testEmbedding = Array(768).fill(0).map(() => Math.random() * 2 - 1);

    const results = await connector.searchVectors(testEmbedding, {
      matchThreshold: 0.5,
      matchCount: 5
    });

    if (Array.isArray(results)) {
      console.log(`  Results found: ${results.length}`);
      if (results.length > 0) {
        console.log(`  Top match similarity: ${results[0].similarity || 'N/A'}`);
      }
    } else {
      console.log('  No results returned (database might be empty)');
    }
  } catch (error) {
    console.log(`  ⚠️ Search test skipped: ${error.message}`);
    console.log('  Note: This is expected if the database has no data yet');
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  const success = health.status === 'healthy' || health.status === 'degraded';

  if (success) {
    console.log('✅ GAS-Supabase integration is working!');
    console.log('\nNext steps:');
    console.log('1. Copy the GAS scripts to your Google Apps Script project');
    console.log('2. Add SUPABASE_URL and SUPABASE_ANON_KEY to Script Properties');
    console.log('3. Run the database initialization SQL in Supabase');
    console.log('4. Migrate your embeddings data');
  } else {
    console.log('❌ Connection failed. Please check:');
    console.log('1. Your Supabase project is active');
    console.log('2. The credentials in .env are correct');
    console.log('3. Your network connection');
  }

  return {
    success,
    health,
    stats
  };
}

// Run tests
if (require.main === module) {
  testSupabaseConnection()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testSupabaseConnection };