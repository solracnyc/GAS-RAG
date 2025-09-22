require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DocumentChunker = require('../utils/chunker');

/**
 * Embedding Generator using Google's Gemini API
 * Free tier: 100 RPM, 30K TPM, 1K RPD
 */
class EmbeddingGenerator {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.GOOGLE_AI_KEY;
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_KEY not found in environment');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = 'models/embedding-001';
    this.dimensions = config.dimensions || parseInt(process.env.EMBEDDING_DIMENSIONS) || 768;
    this.batchSize = config.batchSize || 10;
    this.rateLimit = {
      requestsPerMinute: 100,
      tokensPerMinute: 30000,
      requestsPerDay: 1000
    };

    // Track usage
    this.usage = {
      requests: 0,
      tokens: 0,
      errors: 0
    };
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = this.genAI.getGenerativeModel({ model: this.model });

        // Truncate text if too long (max ~2048 tokens)
        const truncatedText = this.truncateText(text, 8000); // ~2000 tokens

        const result = await model.embedContent({
          content: { parts: [{ text: truncatedText }] },
          taskType: taskType,
          outputDimensionality: this.dimensions
        });

        this.usage.requests++;
        this.usage.tokens += this.estimateTokens(truncatedText);

        return result.embedding.values;
      } catch (error) {
        lastError = error;

        if (error.message?.includes('429') || error.message?.includes('RATE_LIMIT')) {
          // Rate limit hit - exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 32000);
          console.log(`⏳ Rate limited. Waiting ${delay / 1000}s before retry...`);
          await this.sleep(delay);
        } else if (attempt < maxRetries - 1) {
          // Other error - simple retry with delay
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    this.usage.errors++;
    throw new Error(`Failed to generate embedding after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Process chunks in batches
   */
  async processChunks(chunks) {
    console.log(`\n🧮 Generating embeddings for ${chunks.length} chunks`);
    console.log(`   Model: ${this.model}`);
    console.log(`   Dimensions: ${this.dimensions}`);
    console.log(`   Batch Size: ${this.batchSize}\n`);

    const embeddedChunks = [];
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / this.batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches}...`);

      try {
        const embeddedBatch = await this.processBatch(batch);
        embeddedChunks.push(...embeddedBatch);

        // Display progress
        const progress = Math.min(i + this.batchSize, chunks.length);
        const percentage = ((progress / chunks.length) * 100).toFixed(1);
        console.log(`✓ Progress: ${progress}/${chunks.length} (${percentage}%)`);

        // Rate limiting - 100 RPM means ~600ms between batches
        if (i + this.batchSize < chunks.length) {
          await this.sleep(600);
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNum} failed:`, error.message);
        // Continue with next batch
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n✅ Embedding generation complete!`);
    console.log(`   - Chunks processed: ${embeddedChunks.length}/${chunks.length}`);
    console.log(`   - Time taken: ${duration}s`);
    console.log(`   - Requests made: ${this.usage.requests}`);
    console.log(`   - Estimated tokens: ${this.usage.tokens}`);
    console.log(`   - Errors: ${this.usage.errors}`);

    return embeddedChunks;
  }

  /**
   * Process a single batch
   */
  async processBatch(batch) {
    const embeddedChunks = [];

    for (const chunk of batch) {
      try {
        const embedding = await this.generateEmbedding(
          chunk.content,
          'RETRIEVAL_DOCUMENT'
        );

        // Calculate vector norm for optimized similarity search
        const norm = this.calculateNorm(embedding);

        embeddedChunks.push({
          ...chunk,
          embedding: embedding,
          embedding_model: this.model,
          embedding_dimensions: this.dimensions,
          vector_norm: norm
        });
      } catch (error) {
        console.error(`   ⚠️ Failed to embed chunk ${chunk.id}: ${error.message}`);
      }
    }

    return embeddedChunks;
  }

  /**
   * Generate query embedding (different task type)
   */
  async generateQueryEmbedding(query) {
    return this.generateEmbedding(query, 'RETRIEVAL_QUERY');
  }

  /**
   * Process crawled data end-to-end
   */
  async processData(inputPath) {
    try {
      // Load crawled data
      console.log(`\n📂 Loading data from: ${inputPath}`);
      const rawData = await fs.readFile(inputPath, 'utf-8');
      const pages = JSON.parse(rawData);

      // Chunk the pages
      console.log(`\n✂️ Chunking ${pages.length} pages...`);
      const chunker = new DocumentChunker();
      const { chunks, stats: chunkStats } = chunker.processPages(pages);

      // Generate embeddings
      const embeddedChunks = await this.processChunks(chunks);

      // Save results
      const outputPath = await this.saveEmbeddings(embeddedChunks);

      return {
        chunks: embeddedChunks.length,
        outputPath,
        chunkStats,
        usage: this.usage
      };
    } catch (error) {
      console.error('❌ Processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Save embedded chunks
   */
  async saveEmbeddings(chunks) {
    const timestamp = Date.now();
    const outputDir = path.join(process.cwd(), 'data', 'processed');

    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `embeddings_${timestamp}.json`);
    await fs.writeFile(outputPath, JSON.stringify(chunks, null, 2));

    console.log(`\n💾 Embeddings saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Helper: Calculate vector norm
   */
  calculateNorm(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Helper: Truncate text to character limit
   */
  truncateText(text, maxChars) {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '...';
  }

  /**
   * Helper: Estimate token count
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Helper: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if executed directly
if (require.main === module) {
  const generator = new EmbeddingGenerator();

  // Get most recent crawl file
  const dataDir = path.join(process.cwd(), 'data', 'raw');

  fs.readdir(dataDir)
    .then(files => {
      const crawlFiles = files.filter(f => f.startsWith('crawl_') && f.endsWith('.json'));
      if (crawlFiles.length === 0) {
        throw new Error('No crawl data found. Run crawler first.');
      }

      // Use most recent file
      crawlFiles.sort().reverse();
      const inputPath = path.join(dataDir, crawlFiles[0]);
      console.log(`Using crawl data: ${crawlFiles[0]}`);

      return generator.processData(inputPath);
    })
    .then(result => {
      console.log('\n✅ Embedding generation complete!');
      console.log(`   Output: ${result.outputPath}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = EmbeddingGenerator;