#!/usr/bin/env node

/**
 * Test script to upload a small sample of embeddings
 * This helps verify the fixes work before attempting full upload
 */

const fs = require('fs');
const https = require('https');

// Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';
const EMBEDDINGS_FILE = './data/processed/embeddings_1758558291750.json';
const TEST_CHUNK_COUNT = 5; // Only send 5 chunks for testing

async function sendTestBatch(chunks) {
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

    console.log(`Sending ${chunks.length} test chunks...`);
    console.log(`First chunk ID: ${chunks[0].id}`);
    console.log(`Payload size: ${Buffer.byteLength(data)} bytes`);

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          console.log('\n=== Server Response ===');
          console.log(JSON.stringify(result, null, 2));

          if (result.success === false || result.error) {
            console.error('\n❌ ERROR:', result.error || 'Unknown error');
          } else {
            console.log('\n✅ SUCCESS!');
            console.log(`  Imported: ${result.imported} chunks`);
            console.log(`  Total in sheet: ${result.total} chunks`);
            console.log(`  Processed: ${result.processed || 'N/A'}`);
            console.log(`  Errors: ${result.errors || 0}`);
          }

          resolve(result);
        } catch (e) {
          console.error('\n❌ Failed to parse response:', e.message);
          console.error('Raw response:', responseData.substring(0, 500));
          resolve({ error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function testUpload() {
  try {
    // Read the embeddings file
    console.log(`\n=== Test Upload Script ===`);
    console.log(`Reading embeddings from ${EMBEDDINGS_FILE}...`);
    const fileContent = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
    const allChunks = JSON.parse(fileContent);

    console.log(`Total chunks available: ${allChunks.length}`);
    console.log(`Testing with first ${TEST_CHUNK_COUNT} chunks\n`);

    // Get test chunks
    const testChunks = allChunks.slice(0, TEST_CHUNK_COUNT);

    // Display chunk info
    console.log('Test chunk IDs:');
    testChunks.forEach((chunk, idx) => {
      console.log(`  ${idx + 1}. ${chunk.id} - ${chunk.content.substring(0, 50)}...`);
    });

    console.log('\nSending test batch...\n');

    // Send the test batch
    const result = await sendTestBatch(testChunks);

    // Verify the results
    if (!result.error && result.imported > 0) {
      console.log('\n🎉 Test successful! The fixes are working.');
      console.log('You can now run the full upload with: node upload-embeddings.js');
    } else {
      console.log('\n⚠️ Test completed but no chunks were imported.');
      console.log('Check the Google Apps Script logs for more details.');
      console.log('Make sure to redeploy the Web App after making changes.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
console.log('Starting small test upload to Google Apps Script...');
console.log(`Web App URL: ${WEB_APP_URL}\n`);

testUpload().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});