#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Vector Database Migrator
 * Migrates embeddings from JSON files to Supabase pgvector
 */
class SupabaseMigrator {
  constructor(supabaseUrl, supabaseKey, options = {}) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.batchSize = options.batchSize || 50;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.checkpointFile = options.checkpointFile || '.migration_checkpoint.json';

    // Track migration statistics
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  /**
   * Main migration entry point
   */
  async migrate(jsonFilePath) {
    console.log('🚀 Starting Supabase migration...');
    console.log(`📁 Source file: ${jsonFilePath}`);

    try {
      // Load and validate JSON data
      const data = await this.loadJsonData(jsonFilePath);
      const chunks = this.extractChunks(data);

      if (!chunks || chunks.length === 0) {
        throw new Error('No chunks found in JSON file');
      }

      this.stats.total = chunks.length;
      console.log(`📊 Found ${chunks.length} chunks to migrate`);

      // Check for existing checkpoint
      const checkpoint = await this.loadCheckpoint();
      const startIndex = checkpoint?.lastProcessed || 0;

      if (startIndex > 0) {
        console.log(`♻️ Resuming from checkpoint (chunk ${startIndex}/${chunks.length})`);
        this.stats = checkpoint.stats || this.stats;
      }

      // Process chunks in batches
      await this.processBatches(chunks, startIndex);

      // Clean up checkpoint on success
      if (this.stats.successful === this.stats.total) {
        await this.deleteCheckpoint();
      }

      // Generate final report
      this.printReport();

      return this.stats;

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Load JSON data from file
   */
  async loadJsonData(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load JSON file: ${error.message}`);
    }
  }

  /**
   * Extract chunks from various JSON formats
   */
  extractChunks(data) {
    // Handle different JSON structures
    if (Array.isArray(data)) {
      return data;
    } else if (data.chunks) {
      return data.chunks;
    } else if (data.embeddings) {
      return data.embeddings;
    } else if (data.data) {
      return data.data;
    }

    // If single object, wrap in array
    return [data];
  }

  /**
   * Process chunks in batches
   */
  async processBatches(chunks, startIndex = 0) {
    const totalBatches = Math.ceil((chunks.length - startIndex) / this.batchSize);
    let batchCount = 0;

    for (let i = startIndex; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      const batchNumber = ++batchCount;
      const progress = ((i - startIndex + batch.length) / (chunks.length - startIndex) * 100).toFixed(1);

      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${progress}% complete)`);

      try {
        // Transform batch to Supabase format
        const transformedBatch = await this.transformBatch(batch, i);

        // Insert with retry logic
        const result = await this.insertBatchWithRetry(transformedBatch, batchNumber);

        if (result.success) {
          this.stats.successful += result.count;
          console.log(`✅ Batch ${batchNumber}: ${result.count} chunks inserted`);
        } else {
          this.stats.failed += batch.length;
          this.stats.errors.push({
            batch: batchNumber,
            error: result.error,
            chunkIds: batch.map(c => c.id || `chunk_${i}`)
          });
          console.error(`❌ Batch ${batchNumber} failed: ${result.error}`);
        }

        // Save checkpoint after each batch
        await this.saveCheckpoint(i + batch.length);

        // Rate limiting
        if (i + this.batchSize < chunks.length) {
          await this.sleep(100);
        }

      } catch (error) {
        console.error(`❌ Batch ${batchNumber} error:`, error.message);
        this.stats.failed += batch.length;
        this.stats.errors.push({
          batch: batchNumber,
          error: error.message
        });
      }
    }
  }

  /**
   * Transform batch to Supabase format
   */
  async transformBatch(batch, startIndex) {
    const transformed = [];

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];

      try {
        // Validate and parse embedding
        const embedding = this.validateEmbedding(chunk.embedding);

        // Transform to Supabase schema
        const record = {
          document_id: chunk.id || chunk.chunk_id || `doc_${startIndex + i}`,
          document_title: chunk.title || chunk.document_title || this.extractTitle(chunk),
          document_url: chunk.url || chunk.source_url || chunk.source || '',
          chunk_content: chunk.content || chunk.text || chunk.chunk_content || '',
          chunk_index: chunk.chunk_index !== undefined ? chunk.chunk_index : i,
          chunk_tokens: chunk.tokens || chunk.chunk_tokens || this.estimateTokens(chunk.content),
          embedding: embedding,
          metadata: this.buildMetadata(chunk),
          created_at: chunk.created_at || new Date().toISOString()
        };

        transformed.push(record);

      } catch (error) {
        console.warn(`⚠️ Skipping invalid chunk ${chunk.id || i}: ${error.message}`);
        this.stats.skipped++;
      }
    }

    return transformed;
  }

  /**
   * Validate and normalize embedding
   */
  validateEmbedding(embedding) {
    // Handle string embeddings
    if (typeof embedding === 'string') {
      try {
        embedding = JSON.parse(embedding);
      } catch {
        throw new Error('Invalid embedding format (failed to parse JSON)');
      }
    }

    // Validate array
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }

    // Validate dimensions (768 for Gemini)
    if (embedding.length !== 768) {
      throw new Error(`Invalid embedding dimensions: ${embedding.length} (expected 768)`);
    }

    // Validate values are numbers
    if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
      throw new Error('Embedding contains invalid values');
    }

    return embedding;
  }

  /**
   * Build metadata object from chunk
   */
  buildMetadata(chunk) {
    const metadata = chunk.metadata || {};

    // Add useful fields to metadata
    return {
      ...metadata,
      original_id: chunk.id,
      source: chunk.source || 'migration',
      component_type: chunk.component_type || metadata.component_type,
      chunk_type: chunk.chunk_type || metadata.chunk_type,
      has_code: chunk.has_code || metadata.has_code || false,
      has_example: chunk.has_example || metadata.has_example || false,
      method_signature: chunk.method_signature || metadata.method_signature,
      embedding_model: chunk.embedding_model || 'gemini-embedding-001',
      embedding_dimensions: chunk.embedding_dimensions || 768,
      vector_norm: chunk.vector_norm || null,
      migrated_at: new Date().toISOString()
    };
  }

  /**
   * Extract title from chunk content
   */
  extractTitle(chunk) {
    if (chunk.content) {
      // Try to extract first line as title
      const firstLine = chunk.content.split('\n')[0];
      return firstLine.substring(0, 100);
    }
    return 'Untitled';
  }

  /**
   * Estimate token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Insert batch with retry logic
   */
  async insertBatchWithRetry(batch, batchNumber) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`  📤 Uploading ${batch.length} chunks (attempt ${attempt}/${this.retryAttempts})`);

        const { data, error } = await this.supabase
          .from('document_chunks')
          .upsert(batch, {
            onConflict: 'document_id,chunk_index',
            ignoreDuplicates: false
          })
          .select('id');

        if (error) {
          throw new Error(error.message);
        }

        return {
          success: true,
          count: data ? data.length : batch.length
        };

      } catch (error) {
        lastError = error;
        console.warn(`  ⚠️ Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`  ⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError.message
    };
  }

  /**
   * Load checkpoint from file
   */
  async loadCheckpoint() {
    try {
      const content = await fs.readFile(this.checkpointFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save checkpoint to file
   */
  async saveCheckpoint(lastProcessed) {
    const checkpoint = {
      lastProcessed,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify(checkpoint, null, 2)
    );
  }

  /**
   * Delete checkpoint file
   */
  async deleteCheckpoint() {
    try {
      await fs.unlink(this.checkpointFile);
      console.log('🧹 Checkpoint file cleaned up');
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Print migration report
   */
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total chunks:     ${this.stats.total}`);
    console.log(`Successful:       ${this.stats.successful} (${(this.stats.successful/this.stats.total*100).toFixed(1)}%)`);
    console.log(`Failed:           ${this.stats.failed}`);
    console.log(`Skipped:          ${this.stats.skipped}`);

    if (this.stats.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.stats.errors.slice(0, 5).forEach(err => {
        console.log(`  - Batch ${err.batch}: ${err.error}`);
      });

      if (this.stats.errors.length > 5) {
        console.log(`  ... and ${this.stats.errors.length - 5} more errors`);
      }
    }

    console.log('='.repeat(60));

    if (this.stats.successful === this.stats.total) {
      console.log('✅ Migration completed successfully!');
    } else if (this.stats.successful > 0) {
      console.log('⚠️ Migration partially completed. Run again to retry failed chunks.');
    } else {
      console.log('❌ Migration failed. Check errors and try again.');
    }
  }

  /**
   * Verify migration by checking database
   */
  async verify() {
    console.log('\n🔍 Verifying migration...');

    const { data, error } = await this.supabase
      .from('document_chunks')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Verification failed:', error.message);
      return false;
    }

    console.log(`✅ Database contains ${data} document chunks`);
    return true;
  }

  /**
   * Helper: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node supabase-migrator.js <json-file-path>');
    console.log('\nOptions:');
    console.log('  --batch-size <number>    Batch size for uploads (default: 50)');
    console.log('  --verify                 Verify migration after completion');
    console.log('\nExample:');
    console.log('  node supabase-migrator.js ./data/processed/embeddings_*.json --batch-size 25 --verify');
    process.exit(1);
  }

  // Parse arguments
  const jsonFile = args[0];
  const batchSize = args.includes('--batch-size')
    ? parseInt(args[args.indexOf('--batch-size') + 1])
    : 50;
  const shouldVerify = args.includes('--verify');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
    process.exit(1);
  }

  // Run migration
  const migrator = new SupabaseMigrator(supabaseUrl, supabaseKey, { batchSize });

  migrator.migrate(jsonFile)
    .then(async (stats) => {
      if (shouldVerify) {
        await migrator.verify();
      }
      process.exit(stats.successful === stats.total ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    });
}

module.exports = SupabaseMigrator;