#!/usr/bin/env node

/**
 * Upload embeddings from local JSON file to Google Apps Script Web App
 */

const fs = require('fs');
const https = require('https');

// Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';
const EMBEDDINGS_FILE = './data/processed/embeddings_1758558291750.json';
const BATCH_SIZE = 25; // Reduced from 50 to avoid memory issues and JSON parsing failures
const RETRY_ATTEMPTS = 3; // Retry failed batches
const RETRY_DELAY = 2000; // 2 second delay between retries

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

          // Verify the response indicates success
          if (result.success === false || result.error) {
            console.error(`Batch ${batchNumber} failed on server:`, result.error || 'Unknown error');
            resolve({ error: result.error || 'Server reported failure', serverResponse: result });
          } else if (result.imported === 0 && chunks.length > 0) {
            console.error(`Batch ${batchNumber} WARNING: No chunks imported despite sending ${chunks.length}`);
            resolve({ error: 'No chunks imported', imported: 0, serverResponse: result });
          } else {
            console.log(`Batch ${batchNumber} SUCCESS: Imported ${result.imported}/${chunks.length} chunks`);
            resolve(result);
          }
        } catch (e) {
          console.error(`Error parsing response for batch ${batchNumber}:`, e.message);
          console.error('Response:', responseData.substring(0, 500));
          resolve({ error: 'Failed to parse response', rawResponse: responseData.substring(0, 500) });
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

      let retryCount = 0;
      let batchSuccess = false;

      while (retryCount < RETRY_ATTEMPTS && !batchSuccess) {
        try {
          const result = await sendBatch(batch, batchNumber, totalBatches);

          if (result.error) {
            retryCount++;
            if (retryCount < RETRY_ATTEMPTS) {
              console.log(`Retrying batch ${batchNumber} (attempt ${retryCount + 1}/${RETRY_ATTEMPTS})...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
            } else {
              errorCount += batch.length;
              console.error(`Batch ${batchNumber} failed after ${RETRY_ATTEMPTS} attempts:`, result.error);
            }
          } else {
            // Verify actual import count
            const actualImported = result.imported || 0;
            successCount += actualImported;

            if (actualImported < batch.length) {
              console.warn(`Batch ${batchNumber}: Only ${actualImported}/${batch.length} chunks imported`);
              errorCount += (batch.length - actualImported);
            } else {
              console.log(`✓ Batch ${batchNumber} complete: ${actualImported} chunks imported, total in sheet: ${result.total}`);
            }
            batchSuccess = true;
          }
        } catch (error) {
          retryCount++;
          if (retryCount < RETRY_ATTEMPTS) {
            console.log(`Network error on batch ${batchNumber}, retrying (${retryCount + 1}/${RETRY_ATTEMPTS})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
          } else {
            errorCount += batch.length;
            console.error(`Batch ${batchNumber} failed after ${RETRY_ATTEMPTS} attempts:`, error.message);
          }
        }
      }

      // Add delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < allChunks.length) {
        console.log('Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
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