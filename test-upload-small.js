#!/usr/bin/env node

/**
 * Test script to upload a small sample of embeddings
 * This helps verify the fixes work before attempting full upload
 *
 * UPDATED: Using axios to properly handle 302 redirects with POST→GET method change
 */

const fs = require('fs');
const axios = require('axios');

// Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';
const EMBEDDINGS_FILE = './data/processed/embeddings_1758558291750.json';
const TEST_CHUNK_COUNT = 5; // Only send 5 chunks for testing

async function sendTestBatch(chunks) {
  try {
    console.log(`Sending ${chunks.length} test chunks...`);
    console.log(`First chunk ID: ${chunks[0].id}`);

    const response = await axios.post(WEB_APP_URL, {
      action: 'importChunks',
      chunks: chunks
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      maxRedirects: 5, // Follow up to 5 redirects
      validateStatus: (status) => status < 500 // Accept any status < 500
    });

    console.log('\n=== Server Response ===');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success === false || response.data.error) {
      console.error('\n❌ ERROR:', response.data.error || 'Unknown error');
      return response.data;
    }

    console.log('\n✅ SUCCESS!');
    console.log(`  Imported: ${response.data.imported} chunks`);
    console.log(`  Total in sheet: ${response.data.total} chunks`);
    console.log(`  Processed: ${response.data.processed || 'N/A'}`);
    console.log(`  Errors: ${response.data.errors || 0}`);

    return response.data;

  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('\n❌ Server Error:', error.response.status);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('\n❌ No response from server');
    } else {
      // Error setting up request
      console.error('\n❌ Request Error:', error.message);
    }
    throw error;
  }
}

async function testUpload() {
  try {
    // Read the embeddings file
    console.log(`\n=== Test Upload Script (with axios) ===`);
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
      console.log('The 302 redirect issue is resolved - axios handles it properly.');
      console.log('\nYou can now run the full upload with: node upload-embeddings.js');
    } else if (!result.error && result.imported === 0) {
      console.log('\n⚠️ Connection successful but no chunks were imported.');
      console.log('Check if the chunks already exist in the sheet.');
    } else {
      console.log('\n⚠️ Test completed but encountered issues.');
      console.log('Check the Google Apps Script execution logs for details.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
console.log('Starting test upload to Google Apps Script...');
console.log(`Web App URL: ${WEB_APP_URL}`);
console.log('Using axios for proper redirect handling (POST→GET)\n');

testUpload().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});