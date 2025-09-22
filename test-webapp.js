#!/usr/bin/env node

/**
 * Test the Google Apps Script Web App endpoint
 */

const https = require('https');

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxqw1sP_rvNYf6PJYzsJRpH-yEsNYo31WkYs8LtGaT3MNHqUiiDbVjXU3Fjb_a_xd4g8Q/exec';

// Test with GET request first
function testGet() {
  console.log('Testing GET request...');
  https.get(WEB_APP_URL, (res) => {
    console.log('GET Status:', res.statusCode);
    console.log('GET Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('GET Response:', data.substring(0, 500));
      testPost();
    });
  }).on('error', (err) => {
    console.error('GET Error:', err);
  });
}

// Test with POST request
function testPost() {
  console.log('\nTesting POST request with minimal data...');

  const testData = JSON.stringify({
    action: 'test',
    message: 'Hello from test'
  });

  const url = new URL(WEB_APP_URL);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testData)
    }
  };

  const req = https.request(url, options, (res) => {
    console.log('POST Status:', res.statusCode);
    console.log('POST Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('POST Response:', data.substring(0, 500));

      // Now test with a single chunk
      testSingleChunk();
    });
  });

  req.on('error', (err) => {
    console.error('POST Error:', err);
  });

  req.write(testData);
  req.end();
}

// Test with a single chunk
function testSingleChunk() {
  console.log('\nTesting POST with single chunk...');

  const testChunk = {
    action: 'importChunks',
    chunks: [{
      id: 'test_001',
      content: 'Test content for Google Apps Script',
      embedding: Array(768).fill(0.1), // Simple test embedding
      source_url: 'https://test.com',
      component_type: 'test',
      chunk_type: 'test',
      embedding_dimensions: 768
    }]
  };

  const testData = JSON.stringify(testChunk);
  const url = new URL(WEB_APP_URL);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testData)
    }
  };

  const req = https.request(url, options, (res) => {
    console.log('Single Chunk Status:', res.statusCode);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Single Chunk Response:', data);
    });
  });

  req.on('error', (err) => {
    console.error('Single Chunk Error:', err);
  });

  req.write(testData);
  req.end();
}

// Start tests
console.log('Testing Web App URL:', WEB_APP_URL);
console.log('---');
testGet();