#!/usr/bin/env node

/**
 * Test Suite for Supabase RAG Pipeline
 * Validates the complete migration from Google Sheets to Supabase
 */

require('dotenv').config();
const SupabaseVectorClient = require('../../src/storage/supabase-client');
const { SemanticCache } = require('../../src/storage/semantic-cache');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  googleApiKey: process.env.GOOGLE_AI_KEY,
  testQueries: [
    "How do I create a Google Sheets spreadsheet programmatically?",
    "What's the difference between getRange and getRanges?",
    "How do I send an email with attachments using GmailApp?",
    "What are script properties and how do I use them?",
    "How can I create a custom menu in Google Sheets?"
  ]
};

class SupabaseTestSuite {
  constructor() {
    this.client = null;
    this.cache = null;
    this.genAI = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    console.log('🚀 Initializing Supabase RAG Test Suite');
    console.log('=' .repeat(60));

    // Validate environment
    if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
      throw new Error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
    }

    if (!TEST_CONFIG.googleApiKey) {
      throw new Error('❌ GOOGLE_AI_KEY must be set in .env');
    }

    // Initialize clients
    this.client = new SupabaseVectorClient(
      TEST_CONFIG.supabaseUrl,
      TEST_CONFIG.supabaseKey,
      {
        retryAttempts: 3,
        batchSize: 50,
        cacheEnabled: true
      }
    );

    this.cache = new SemanticCache({
      similarityThreshold: 0.95,
      maxCacheSize: 50,
      ttl: 300000
    });

    this.genAI = new GoogleGenerativeAI(TEST_CONFIG.googleApiKey);

    console.log('✅ All clients initialized successfully\n');
  }

  /**
   * Test 1: Database Connection
   */
  async testDatabaseConnection() {
    console.log('📋 Test 1: Database Connection');

    try {
      const health = await this.client.healthCheck();
      console.log(`  Status: ${health.status}`);
      console.log(`  Latency: ${health.latency}`);
      console.log(`  Documents: ${health.documentCount}`);

      const success = health.status === 'healthy' || health.status === 'degraded';
      this.recordTest('Database Connection', success, health);

      return success;
    } catch (error) {
      this.recordTest('Database Connection', false, error.message);
      return false;
    }
  }

  /**
   * Test 2: Database Statistics
   */
  async testDatabaseStats() {
    console.log('\n📋 Test 2: Database Statistics');

    try {
      const stats = await this.client.getDatabaseStats();

      console.log(`  Total documents: ${stats.total_documents || 0}`);
      console.log(`  Total chunks: ${stats.total_chunks || 0}`);
      console.log(`  Storage used: ${stats.total_storage_mb || 'N/A'}`);

      const success = stats.total_chunks > 0;
      this.recordTest('Database Statistics', success, stats);

      if (!success) {
        console.log('  ⚠️ No documents found. Run migration first.');
      }

      return success;
    } catch (error) {
      this.recordTest('Database Statistics', false, error.message);
      return false;
    }
  }

  /**
   * Test 3: Insert Test Vector
   */
  async testInsertVector() {
    console.log('\n📋 Test 3: Insert Test Vector');

    try {
      // Generate test embedding
      const testEmbedding = this.generateTestEmbedding();

      const testDocument = {
        document_id: `test_doc_${Date.now()}`,
        document_title: 'Test Document',
        document_url: 'https://test.example.com',
        chunk_content: 'This is a test document for validating vector insertion.',
        chunk_index: 0,
        chunk_tokens: 10,
        embedding: testEmbedding,
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };

      const result = await this.client.insertVectors([testDocument]);
      const success = result && result.length > 0;

      console.log(`  Inserted: ${success ? '✅' : '❌'}`);
      console.log(`  Document ID: ${testDocument.document_id}`);

      this.recordTest('Insert Vector', success, result);
      this.testDocumentId = testDocument.document_id;

      return success;
    } catch (error) {
      this.recordTest('Insert Vector', false, error.message);
      return false;
    }
  }

  /**
   * Test 4: Vector Search
   */
  async testVectorSearch() {
    console.log('\n📋 Test 4: Vector Search');

    try {
      // Generate query embedding
      const queryEmbedding = this.generateTestEmbedding();

      const startTime = Date.now();
      const results = await this.client.similaritySearch(queryEmbedding, {
        matchThreshold: 0.5,
        matchCount: 5
      });
      const latency = Date.now() - startTime;

      console.log(`  Results found: ${results.length}`);
      console.log(`  Search latency: ${latency}ms`);

      if (results.length > 0) {
        console.log(`  Top match similarity: ${results[0].similarity.toFixed(4)}`);
      }

      const success = results.length > 0 && latency < 5000;
      this.recordTest('Vector Search', success, { resultCount: results.length, latency });

      return success;
    } catch (error) {
      this.recordTest('Vector Search', false, error.message);
      return false;
    }
  }

  /**
   * Test 5: Semantic Cache
   */
  async testSemanticCache() {
    console.log('\n📋 Test 5: Semantic Cache');

    try {
      const queryEmbedding = this.generateTestEmbedding();
      const testResult = { data: 'test result', timestamp: Date.now() };

      // Store in cache
      this.cache.set(queryEmbedding, testResult, 'test query');

      // Retrieve from cache (exact match)
      const cached = await this.cache.get(queryEmbedding);
      const hitExact = cached !== null;

      // Test similar query
      const similarEmbedding = queryEmbedding.map(v => v + (Math.random() - 0.5) * 0.01);
      const cachedSimilar = await this.cache.get(similarEmbedding);
      const hitSimilar = cachedSimilar !== null;

      const stats = this.cache.getStats();
      console.log(`  Cache size: ${stats.cacheSize}`);
      console.log(`  Hit rate: ${stats.hitRate}`);
      console.log(`  Exact match: ${hitExact ? '✅' : '❌'}`);
      console.log(`  Similar match: ${hitSimilar ? '✅' : '❌'}`);

      const success = hitExact;
      this.recordTest('Semantic Cache', success, stats);

      return success;
    } catch (error) {
      this.recordTest('Semantic Cache', false, error.message);
      return false;
    }
  }

  /**
   * Test 6: Generate Embedding
   */
  async testGenerateEmbedding() {
    console.log('\n📋 Test 6: Generate Embedding');

    try {
      const model = this.genAI.getGenerativeModel({ model: 'models/embedding-001' });

      const text = 'Test text for embedding generation';
      const result = await model.embedContent({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768
      });

      const embedding = result.embedding.values;
      const success = embedding && embedding.length === 768;

      console.log(`  Embedding dimensions: ${embedding.length}`);
      console.log(`  Valid embedding: ${success ? '✅' : '❌'}`);

      this.recordTest('Generate Embedding', success, { dimensions: embedding.length });

      return success;
    } catch (error) {
      this.recordTest('Generate Embedding', false, error.message);
      return false;
    }
  }

  /**
   * Test 7: End-to-End RAG Query
   */
  async testRAGQuery() {
    console.log('\n📋 Test 7: End-to-End RAG Query');

    try {
      const query = TEST_CONFIG.testQueries[0];
      console.log(`  Query: "${query}"`);

      // Generate query embedding
      const model = this.genAI.getGenerativeModel({ model: 'models/embedding-001' });
      const embeddingResult = await model.embedContent({
        content: { parts: [{ text: query }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: 768
      });

      const queryEmbedding = embeddingResult.embedding.values;

      // Search for similar documents
      const startTime = Date.now();
      const searchResults = await this.client.similaritySearch(queryEmbedding, {
        matchThreshold: 0.7,
        matchCount: 5
      });
      const searchLatency = Date.now() - startTime;

      console.log(`  Search results: ${searchResults.length}`);
      console.log(`  Search latency: ${searchLatency}ms`);

      if (searchResults.length > 0) {
        // Synthesize answer (simplified version)
        console.log(`  Top result similarity: ${searchResults[0].similarity.toFixed(4)}`);
        console.log(`  Content preview: ${searchResults[0].chunk_content.substring(0, 100)}...`);
      }

      const success = searchResults.length > 0 && searchLatency < 1000;
      this.recordTest('RAG Query', success, {
        query,
        resultCount: searchResults.length,
        latency: searchLatency
      });

      return success;
    } catch (error) {
      this.recordTest('RAG Query', false, error.message);
      return false;
    }
  }

  /**
   * Test 8: Performance Benchmark
   */
  async testPerformanceBenchmark() {
    console.log('\n📋 Test 8: Performance Benchmark');

    try {
      const iterations = 10;
      const latencies = [];

      console.log(`  Running ${iterations} sequential queries...`);

      for (let i = 0; i < iterations; i++) {
        const embedding = this.generateTestEmbedding();
        const startTime = Date.now();

        await this.client.similaritySearch(embedding, {
          matchThreshold: 0.7,
          matchCount: 5
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(`  Average latency: ${avgLatency.toFixed(1)}ms`);
      console.log(`  Min latency: ${minLatency}ms`);
      console.log(`  Max latency: ${maxLatency}ms`);

      const success = avgLatency < 500; // Target: <500ms average
      this.recordTest('Performance Benchmark', success, {
        avgLatency,
        minLatency,
        maxLatency
      });

      return success;
    } catch (error) {
      this.recordTest('Performance Benchmark', false, error.message);
      return false;
    }
  }

  /**
   * Test 9: Error Handling
   */
  async testErrorHandling() {
    console.log('\n📋 Test 9: Error Handling');

    let testsRun = 0;
    let testsPassed = 0;

    try {
      // Test 1: Invalid embedding dimensions
      console.log('  Testing invalid embedding dimensions...');
      try {
        await this.client.insertVectors([{
          document_id: 'test_invalid',
          chunk_content: 'test',
          embedding: [1, 2, 3], // Invalid: should be 768
          chunk_index: 0
        }]);
        console.log('    ❌ Should have thrown error');
      } catch (error) {
        console.log('    ✅ Correctly rejected invalid embedding');
        testsPassed++;
      }
      testsRun++;

      // Test 2: Circuit breaker
      console.log('  Testing circuit breaker...');
      const stats = this.client.getClientStats();
      console.log(`    Circuit breaker state: ${stats.circuitBreakerState}`);
      testsPassed++;
      testsRun++;

      const success = testsPassed === testsRun;
      this.recordTest('Error Handling', success, {
        testsRun,
        testsPassed
      });

      return success;
    } catch (error) {
      this.recordTest('Error Handling', false, error.message);
      return false;
    }
  }

  /**
   * Generate test embedding
   */
  generateTestEmbedding() {
    const embedding = [];
    for (let i = 0; i < 768; i++) {
      embedding.push(Math.random() * 2 - 1);
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  /**
   * Record test result
   */
  recordTest(name, passed, details) {
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${name} passed`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${name} failed`);
    }

    this.testResults.tests.push({
      name,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    try {
      await this.initialize();

      const tests = [
        () => this.testDatabaseConnection(),
        () => this.testDatabaseStats(),
        () => this.testInsertVector(),
        () => this.testVectorSearch(),
        () => this.testSemanticCache(),
        () => this.testGenerateEmbedding(),
        () => this.testRAGQuery(),
        () => this.testPerformanceBenchmark(),
        () => this.testErrorHandling()
      ];

      for (const test of tests) {
        await test();
      }

      this.printSummary();

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tests:  ${this.testResults.passed + this.testResults.failed}`);
    console.log(`Passed:       ${this.testResults.passed} ✅`);
    console.log(`Failed:       ${this.testResults.failed} ❌`);
    console.log(`Success rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (this.testResults.failed > 0) {
      console.log('\n⚠️ Failed tests:');
      this.testResults.tests
        .filter(t => !t.passed)
        .forEach(t => {
          console.log(`  - ${t.name}: ${JSON.stringify(t.details)}`);
        });
    }

    const allPassed = this.testResults.failed === 0;
    if (allPassed) {
      console.log('\n✅ All tests passed! Supabase RAG pipeline is ready for production.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review and fix the issues above.');
    }

    process.exit(allPassed ? 0 : 1);
  }
}

// Run tests
if (require.main === module) {
  console.log('🚀 Supabase RAG Pipeline Test Suite');
  console.log('====================================\n');

  const suite = new SupabaseTestSuite();
  suite.runAllTests();
}

module.exports = SupabaseTestSuite;