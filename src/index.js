require('dotenv').config();
const FirecrawlCrawler = require('./scraper/crawler');
const EmbeddingGenerator = require('./embeddings/generator');
const path = require('path');
const fs = require('fs').promises;

/**
 * Main pipeline orchestrator
 * Coordinates the entire RAG pipeline from crawling to embeddings
 */
class GASRAGPipeline {
  constructor() {
    this.crawler = new FirecrawlCrawler();
    this.embedder = new EmbeddingGenerator();
  }

  /**
   * Run the complete pipeline
   */
  async run(options = {}) {
    console.log('🚀 Starting GAS-RAG Pipeline\n');
    console.log('=' .repeat(50));

    const startTime = Date.now();
    const results = {
      crawl: null,
      embeddings: null,
      errors: []
    };

    try {
      // Phase 1: Crawl documentation
      if (options.skipCrawl) {
        console.log('⏭️  Skipping crawl phase (using existing data)\n');
      } else {
        console.log('\n📥 PHASE 1: CRAWLING DOCUMENTATION');
        console.log('-'.repeat(50));

        results.crawl = await this.crawler.run();

        console.log('\n✅ Crawl phase complete!');
        console.log(`   Data saved: ${results.crawl.dataPath}`);
      }

      // Phase 2: Generate embeddings
      if (options.skipEmbeddings) {
        console.log('⏭️  Skipping embedding phase\n');
      } else {
        console.log('\n🧮 PHASE 2: GENERATING EMBEDDINGS');
        console.log('-'.repeat(50));

        // Use crawl output or find latest
        let dataPath = results.crawl?.dataPath;
        if (!dataPath) {
          dataPath = await this.findLatestCrawlData();
        }

        results.embeddings = await this.embedder.processData(dataPath);

        console.log('\n✅ Embedding phase complete!');
        console.log(`   Embeddings saved: ${results.embeddings.outputPath}`);
      }

      // Calculate total time
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Final summary
      console.log('\n' + '='.repeat(50));
      console.log('✅ PIPELINE COMPLETE!');
      console.log('='.repeat(50));
      console.log('\n📊 Summary:');

      if (results.crawl) {
        console.log(`   Pages crawled: ${results.crawl.stats.totalPages}`);
        console.log(`   Methods extracted: ${results.crawl.stats.totalMethods}`);
        console.log(`   Properties extracted: ${results.crawl.stats.totalProperties}`);
      }

      if (results.embeddings) {
        console.log(`   Chunks created: ${results.embeddings.chunks}`);
        console.log(`   API requests: ${results.embeddings.usage.requests}`);
      }

      console.log(`   Total time: ${duration} seconds`);
      console.log('\n💡 Next steps:');
      console.log('   1. Import embeddings to Google Sheets or Supabase');
      console.log('   2. Set up RAG search with Gemini 2.5 Pro');
      console.log('   3. Test search functionality');

      return results;

    } catch (error) {
      console.error('\n❌ Pipeline failed:', error.message);
      results.errors.push(error);
      throw error;
    }
  }

  /**
   * Find the most recent crawl data file
   */
  async findLatestCrawlData() {
    const dataDir = path.join(process.cwd(), 'data', 'raw');
    const files = await fs.readdir(dataDir);

    const crawlFiles = files.filter(f => f.startsWith('crawl_') && f.endsWith('.json'));
    if (crawlFiles.length === 0) {
      throw new Error('No crawl data found. Please run crawl first.');
    }

    crawlFiles.sort().reverse();
    const latestFile = path.join(dataDir, crawlFiles[0]);

    console.log(`   Using existing crawl data: ${crawlFiles[0]}`);
    return latestFile;
  }

  /**
   * Run specific phase only
   */
  async runPhase(phase) {
    switch (phase) {
      case 'crawl':
        return await this.crawler.run();

      case 'embed':
        const dataPath = await this.findLatestCrawlData();
        return await this.embedder.processData(dataPath);

      default:
        throw new Error(`Unknown phase: ${phase}. Use 'crawl' or 'embed'`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const pipeline = new GASRAGPipeline();
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options = {
    skipCrawl: args.includes('--skip-crawl'),
    skipEmbeddings: args.includes('--skip-embeddings'),
    phase: args.find(arg => !arg.startsWith('--'))
  };

  // Run specific phase or full pipeline
  const runPromise = options.phase
    ? pipeline.runPhase(options.phase)
    : pipeline.run(options);

  runPromise
    .then(() => {
      console.log('\n👍 All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error.message);
      process.exit(1);
    });
}

module.exports = GASRAGPipeline;