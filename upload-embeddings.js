#!/usr/bin/env node

/**
 * Upload embeddings from local JSON file to Google Apps Script Web App
 */

const fs = require('fs');
const https = require('https');

// Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';
const EMBEDDINGS_FILE = './data/processed/embeddings_1758558291750.json';
const BATCH_SIZE = 50; // Send 50 chunks at a time to avoid timeout

async function sendBatch(chunks, batchNumber, totalBatches) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      action: 'importChunks',
      chunks: chunks
    });

    const url = new URL(WEB_APP_URL);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    console.log(`Sending batch ${batchNumber}/${totalBatches} (${chunks.length} chunks)...`);

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          console.log(`Batch ${batchNumber} response:`, result);
          resolve(result);
        } catch (e) {
          console.error(`Error parsing response for batch ${batchNumber}:`, e.message);
          console.error('Response:', responseData);
          resolve({ error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request error for batch ${batchNumber}:`, error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function uploadEmbeddings() {
  try {
    // Read the embeddings file
    console.log(`Reading embeddings from ${EMBEDDINGS_FILE}...`);
    const fileContent = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
    const allChunks = JSON.parse(fileContent);

    console.log(`Found ${allChunks.length} chunks total`);

    // Process in batches
    const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const result = await sendBatch(batch, batchNumber, totalBatches);

        if (result.error) {
          errorCount += batch.length;
          console.error(`Batch ${batchNumber} failed:`, result.error);
        } else {
          successCount += batch.length;
          console.log(`Successfully imported batch ${batchNumber}`);
        }

        // Add a small delay between batches to avoid overwhelming the server
        if (i + BATCH_SIZE < allChunks.length) {
          console.log('Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        errorCount += batch.length;
        console.error(`Failed to send batch ${batchNumber}:`, error.message);
      }
    }

    console.log('\n=== Upload Complete ===');
    console.log(`Total chunks processed: ${allChunks.length}`);
    console.log(`Successfully uploaded: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

  } catch (error) {
    console.error('Error reading or processing embeddings file:', error.message);
    process.exit(1);
  }
}

// Run the upload
console.log('Starting embeddings upload to Google Apps Script...');
console.log(`Web App URL: ${WEB_APP_URL}`);
console.log(`Batch size: ${BATCH_SIZE} chunks per request\n`);

uploadEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});