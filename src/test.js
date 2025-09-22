require('dotenv').config();

/**
 * Test script to verify API configurations
 */
async function runTests() {
  console.log('🧪 Running GAS-RAG Tests\n');
  console.log('='.repeat(50));

  const results = {
    firecrawl: false,
    gemini: false,
    structure: false
  };

  // Test 1: Check environment variables
  console.log('\n📋 Test 1: Environment Variables');
  console.log('-'.repeat(30));

  const required = ['FIRECRAWL_API_KEY', 'GOOGLE_AI_KEY'];
  const missing = [];

  required.forEach(key => {
    if (process.env[key]) {
      console.log(`✅ ${key}: Found`);
    } else {
      console.log(`❌ ${key}: Missing`);
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    console.log('\n⚠️  Please set missing environment variables in .env file');
    console.log('   Copy .env.example to .env and add your keys');
  }

  // Test 2: Verify Firecrawl API
  console.log('\n🔥 Test 2: Firecrawl API Connection');
  console.log('-'.repeat(30));

  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://api.firecrawl.dev/v2/account', {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ API Connected`);
        console.log(`   Credits remaining: ${data.creditsRemaining || 'Unknown'}`);
        results.firecrawl = true;
      } else {
        console.log(`❌ API Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
    }
  } else {
    console.log('⏭️  Skipped (no API key)');
  }

  // Test 3: Verify Google AI API
  console.log('\n🤖 Test 3: Google AI API Connection');
  console.log('-'.repeat(30));

  if (process.env.GOOGLE_AI_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
      const model = genAI.getGenerativeModel({ model: 'models/embedding-001' });

      // Test with a simple embedding
      const result = await model.embedContent({
        content: { parts: [{ text: 'test' }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768
      });

      if (result.embedding) {
        console.log(`✅ API Connected`);
        console.log(`   Embedding dimensions: ${result.embedding.values.length}`);
        results.gemini = true;
      }
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      if (error.message.includes('API_KEY_INVALID')) {
        console.log('   Please check your Google AI Studio API key');
      }
    }
  } else {
    console.log('⏭️  Skipped (no API key)');
  }

  // Test 4: Verify project structure
  console.log('\n📁 Test 4: Project Structure');
  console.log('-'.repeat(30));

  const fs = require('fs');
  const requiredDirs = ['data', 'data/raw', 'data/processed', 'logs', 'output'];

  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir}/`);
    } else {
      console.log(`❌ ${dir}/ (missing)`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ↳ Created`);
    }
  });

  results.structure = true;

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = Object.values(results).filter(v => v).length;
  const total = Object.keys(results).length;

  console.log(`\nTests passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('✅ All tests passed! Ready to run pipeline.');
  } else {
    console.log('⚠️  Some tests failed. Check configuration above.');
  }

  // Usage instructions
  console.log('\n💡 Quick Start:');
  console.log('   npm run crawl     - Crawl documentation');
  console.log('   npm run embed     - Generate embeddings');
  console.log('   npm run pipeline  - Run full pipeline');

  return results;
}

// Run tests
if (require.main === module) {
  runTests()
    .then(results => {
      const allPassed = Object.values(results).every(v => v);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = runTests;