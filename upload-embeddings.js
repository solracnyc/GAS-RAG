#!/usr/bin/env node

/**
 * Upload embeddings from local JSON file to Google Apps Script Web App
 *
 * UPDATED: Using axios to properly handle 302 redirects with POST→GET method change
 */

const fs = require('fs');
const axios = require('axios');

// Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';
const EMBEDDINGS_FILE = './data/processed/embeddings_1758558291750.json';
const BATCH_SIZE = 25; // Reduced from 50 to avoid memory issues and JSON parsing failures
const RETRY_ATTEMPTS = 3; // Retry failed batches
const RETRY_DELAY = 2000; // 2 second delay between retries

async function sendBatch(chunks, batchNumber, totalBatches) {
  try {
    console.log(`Sending batch ${batchNumber}/${totalBatches} (${chunks.length} chunks)...`);

    const response = await axios.post(WEB_APP_URL, {
      action: 'importChunks',
      chunks: chunks
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      maxRedirects: 5,
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500
    });

    console.log(`Batch ${batchNumber} response:`, {
      status: response.status,
      success: response.data.success,
      imported: response.data.imported,
      total: response.data.total
    });

    // Verify the response indicates success
    if (response.data.success === false || response.data.error) {
      console.error(`Batch ${batchNumber} failed on server:`, response.data.error || 'Unknown error');
      return {
        error: response.data.error || 'Server reported failure',
        serverResponse: response.data
      };
    }

    if (response.data.imported === 0 && chunks.length > 0) {
      console.error(`Batch ${batchNumber} WARNING: No chunks imported despite sending ${chunks.length}`);
      return {
        error: 'No chunks imported',
        imported: 0,
        serverResponse: response.data
      };
    }

    console.log(`Batch ${batchNumber} SUCCESS: Imported ${response.data.imported}/${chunks.length} chunks`);
    return response.data;

  } catch (error) {
    if (error.response) {
      console.error(`Batch ${batchNumber} server error:`, error.response.status);
      return { error: `Server error: ${error.response.status}` };
    } else if (error.request) {
      console.error(`Batch ${batchNumber} no response from server`);
      return { error: 'No response from server' };
    } else {
      console.error(`Batch ${batchNumber} request error:`, error.message);
      return { error: error.message };
    }
  }
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

    if (successCount > 0) {
      console.log('\n✅ Upload successful! Check your Google Sheet for the imported data.');
      console.log('The 302 redirect issue has been resolved by using axios.');
    }

  } catch (error) {
    console.error('Error reading or processing embeddings file:', error.message);
    process.exit(1);
  }
}

// Run the upload
console.log('Starting embeddings upload to Google Apps Script...');
console.log(`Web App URL: ${WEB_APP_URL}`);
console.log(`Batch size: ${BATCH_SIZE} chunks per request`);
console.log('Using axios for proper redirect handling (POST→GET)\n');

uploadEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});