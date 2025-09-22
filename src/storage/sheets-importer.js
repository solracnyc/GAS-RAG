require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

/**
 * Google Sheets Vector Importer
 * Imports embedded chunks to Google Sheets via Web App API
 */
class SheetsImporter {
  constructor(config = {}) {
    this.webAppUrl = config.webAppUrl || process.env.SHEETS_WEBAPP_URL;
    this.batchSize = config.batchSize || parseInt(process.env.BATCH_SIZE) || 100;

    if (!this.webAppUrl) {
      throw new Error('SHEETS_WEBAPP_URL not configured in environment');
    }
  }

  /**
   * Import embeddings to Google Sheets
   */
  async importEmbeddings(embeddingsPath) {
    try {
      // Load embeddings
      console.log(`\n📂 Loading embeddings from: ${embeddingsPath}`);
      const rawData = await fs.readFile(embeddingsPath, 'utf-8');
      const chunks = JSON.parse(rawData);

      console.log(`\n📊 Loaded ${chunks.length} embedded chunks`);
      console.log(`   Batch size: ${this.batchSize}`);
      console.log(`   Total batches: ${Math.ceil(chunks.length / this.batchSize)}\n`);

      // Import in batches
      const results = await this.importInBatches(chunks);

      // Display summary
      console.log(`\n✅ Import complete!`);
      console.log(`   - Chunks imported: ${results.totalImported}`);
      console.log(`   - Failed chunks: ${results.failed}`);
      console.log(`   - Time taken: ${results.duration}s`);

      return results;
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      throw error;
    }
  }

  /**
   * Import chunks in batches to avoid timeout
   */
  async importInBatches(chunks) {
    const startTime = Date.now();
    let totalImported = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / this.batchSize);

      console.log(`📤 Importing batch ${batchNum}/${totalBatches}...`);

      try {
        const result = await this.sendBatch(batch);
        totalImported += result.imported || 0;

        const progress = Math.min(i + this.batchSize, chunks.length);
        const percentage = ((progress / chunks.length) * 100).toFixed(1);
        console.log(`   ✓ Progress: ${progress}/${chunks.length} (${percentage}%)`);

      } catch (error) {
        console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
        failed += batch.length;
      }

      // Small delay between batches
      if (i + this.batchSize < chunks.length) {
        await this.sleep(500);
      }
    }

    return {
      totalImported,
      failed,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }

  /**
   * Send a batch of chunks to the Web App
   */
  async sendBatch(chunks) {
    const response = await fetch(this.webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'import',
        chunks: chunks
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Import failed (${response.status}): ${text}`);
    }

    return await response.json();
  }

  /**
   * Check database status
   */
  async checkStatus() {
    console.log('\n🔍 Checking database status...');

    try {
      const response = await fetch(`${this.webAppUrl}?action=status`);
      const status = await response.json();

      console.log('\n📊 Database Status:');
      console.log(`   - Total chunks: ${status.totalChunks || 0}`);
      console.log(`   - Sheet URL: ${status.spreadsheetUrl || 'Not available'}`);
      console.log(`   - Last updated: ${status.lastUpdated || 'Never'}`);

      return status;
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      throw error;
    }
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
  const importer = new SheetsImporter();

  // Get most recent embeddings file
  const dataDir = path.join(process.cwd(), 'data', 'processed');

  fs.readdir(dataDir)
    .then(files => {
      const embeddingFiles = files.filter(f =>
        f.startsWith('embeddings_') && f.endsWith('.json')
      );

      if (embeddingFiles.length === 0) {
        throw new Error('No embeddings found. Run embedding generator first.');
      }

      // Use most recent file
      embeddingFiles.sort().reverse();
      const embeddingsPath = path.join(dataDir, embeddingFiles[0]);
      console.log(`Using embeddings: ${embeddingFiles[0]}`);

      return importer.importEmbeddings(embeddingsPath);
    })
    .then(() => {
      console.log('\n✅ Import to Google Sheets complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = SheetsImporter;