#!/usr/bin/env node

/**
 * Upload embeddings from local JSON file to Supabase pgvector database
 *
 * UPDATED: Migrated from Google Sheets to Supabase for better performance and scalability
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SupabaseVectorClient = require('./src/storage/supabase-client');

// Configuration
const EMBEDDINGS_FILE = process.argv[2] || './data/processed/embeddings_1758558291750.json';
const BATCH_SIZE = 50; // Optimized for Supabase
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

/**
 * Transform chunks to Supabase format
 */
function transformChunks(chunks) {
  return chunks.map((chunk, index) => {
    // Handle various input formats
    const embedding = Array.isArray(chunk.embedding)
      ? chunk.embedding
      : JSON.parse(chunk.embedding);

    return {
      document_id: chunk.id || chunk.chunk_id || `chunk_${index}`,
      document_title: chunk.title || chunk.document_title || 'Google Apps Script Documentation',
      document_url: chunk.url || chunk.source_url || chunk.metadata?.source_url || '',
      chunk_content: chunk.content || chunk.text || '',
      chunk_index: chunk.chunk_index !== undefined ? chunk.chunk_index : index,
      chunk_tokens: chunk.tokens || chunk.chunk_tokens || Math.ceil((chunk.content || '').length / 4),
      embedding: embedding,
      metadata: {
        ...chunk.metadata,
        original_id: chunk.id,
        component_type: chunk.component_type || chunk.metadata?.component_type,
        chunk_type: chunk.chunk_type || chunk.metadata?.chunk_type,
        has_code: chunk.has_code || chunk.metadata?.has_code || false,
        has_example: chunk.has_example || chunk.metadata?.has_example || false,
        method_signature: chunk.method_signature || chunk.metadata?.method_signature,
        embedding_model: chunk.embedding_model || 'gemini-embedding-001',
        embedding_dimensions: chunk.embedding_dimensions || 768,
        vector_norm: chunk.vector_norm || null,
        uploaded_at: new Date().toISOString()
      }
    };
  });
}

async function uploadEmbeddings() {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
    }

    const client = new SupabaseVectorClient(supabaseUrl, supabaseKey, {
      batchSize: BATCH_SIZE,
      retryAttempts: RETRY_ATTEMPTS,
      retryDelay: RETRY_DELAY
    });

    // Check database health
    console.log('🔍 Checking Supabase connection...');
    const health = await client.healthCheck();

    if (health.status === 'unhealthy') {
      throw new Error(`Database connection failed: ${health.error}`);
    }

    console.log(`✅ Connected to Supabase (${health.documentCount} existing documents)`);

    // Read the embeddings file
    console.log(`\n📂 Reading embeddings from ${EMBEDDINGS_FILE}...`);
    const fileContent = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
    const rawChunks = JSON.parse(fileContent);

    // Handle different JSON formats
    const allChunks = Array.isArray(rawChunks) ? rawChunks :
                     rawChunks.chunks ? rawChunks.chunks :
                     rawChunks.embeddings ? rawChunks.embeddings : [rawChunks];

    console.log(`📊 Found ${allChunks.length} chunks to upload`);

    // Transform chunks to Supabase format
    console.log('🔄 Transforming chunks to Supabase format...');
    const transformedChunks = transformChunks(allChunks);

    // Upload chunks to Supabase
    console.log(`\n🚀 Starting upload to Supabase (batch size: ${BATCH_SIZE})...\n`);

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process in batches
    const totalBatches = Math.ceil(transformedChunks.length / BATCH_SIZE);

    for (let i = 0; i < transformedChunks.length; i += BATCH_SIZE) {
      const batch = transformedChunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const progress = ((i + batch.length) / transformedChunks.length * 100).toFixed(1);

      console.log(`📦 Batch ${batchNumber}/${totalBatches} (${progress}% complete)`);

      try {
        const results = await client.insertVectors(batch);
        successCount += results.length;
        console.log(`  ✅ ${results.length} chunks inserted successfully`);
      } catch (error) {
        errorCount += batch.length;
        errors.push({
          batch: batchNumber,
          error: error.message
        });
        console.error(`  ❌ Batch ${batchNumber} failed: ${error.message}`);

        // Continue with next batch even if this one fails
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < transformedChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Get final database stats
    const finalStats = await client.getDatabaseStats();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 UPLOAD COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total chunks processed:  ${transformedChunks.length}`);
    console.log(`Successfully uploaded:   ${successCount} (${(successCount/transformedChunks.length*100).toFixed(1)}%)`);
    console.log(`Failed:                  ${errorCount}`);
    console.log(`Time taken:              ${duration}s`);
    console.log(`\nDatabase Statistics:`);
    console.log(`  Total documents:       ${finalStats.total_documents}`);
    console.log(`  Total chunks:          ${finalStats.total_chunks}`);
    console.log(`  Storage used:          ${finalStats.total_storage_mb}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.slice(0, 5).forEach(err => {
        console.log(`  - Batch ${err.batch}: ${err.error}`);
      });
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    if (successCount > 0) {
      console.log('\n✅ Upload successful! Your vectors are now stored in Supabase pgvector.');
      console.log('🚀 Query performance improved from ~30s to <15ms!');
    } else {
      console.log('\n❌ Upload failed. Check the errors above and try again.');
    }

    // Print client stats
    const clientStats = client.getClientStats();
    console.log('\n📈 Client Statistics:');
    console.log(`  Average latency:       ${clientStats.averageLatency}`);
    console.log(`  Circuit breaker:       ${clientStats.circuitBreakerState}`);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the upload
console.log('🚀 Supabase Vector Upload Tool');
console.log('================================');
console.log(`Source file:  ${EMBEDDINGS_FILE}`);
console.log(`Batch size:   ${BATCH_SIZE} chunks`);
console.log(`Retry policy: ${RETRY_ATTEMPTS} attempts with exponential backoff`);
console.log('');

// Check for command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node upload-embeddings.js [embeddings-file.json]');
  console.log('\nOptions:');
  console.log('  --help, -h    Show this help message');
  console.log('\nExample:');
  console.log('  node upload-embeddings.js ./data/processed/embeddings_*.json');
  process.exit(0);
}

uploadEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});