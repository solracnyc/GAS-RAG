require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

/**
 * Retrieve completed crawl data from Firecrawl
 */
async function retrieveCrawlData(crawlId) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const url = `https://api.firecrawl.dev/v2/crawl/${crawlId}`;

  console.log(`📥 Retrieving crawl data for ID: ${crawlId}`);

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Retrieved data for ${result.completed || result.total} pages`);

    // Process the data
    if (result.data && result.data.length > 0) {
      return processCrawlData(result.data);
    } else {
      throw new Error('No data found in crawl results');
    }

  } catch (error) {
    console.error('Failed to retrieve crawl:', error);
    throw error;
  }
}

function processCrawlData(rawData) {
  const processed = rawData.map(page => {
    // Handle v2 response structure
    let structuredData = {};

    if (page.formats && Array.isArray(page.formats)) {
      const jsonFormat = page.formats.find(f => f.type === 'json');
      if (jsonFormat && jsonFormat.data) {
        structuredData = jsonFormat.data;
      }
    } else if (page.json) {
      structuredData = page.json;
    } else if (page.extract) {
      structuredData = page.extract;
    }

    return {
      url: page.url || page.metadata?.url,
      title: page.metadata?.title || structuredData.page_title || 'Untitled',
      markdown: page.markdown || '',
      structured_data: structuredData,
      component_type: structuredData.component_type || null,
      methods: structuredData.methods || [],
      properties: structuredData.properties || [],
      scrapeDate: new Date().toISOString(),
      metadata: page.metadata || {}
    };
  });

  // Statistics
  const stats = {
    totalPages: processed.length,
    totalMethods: processed.reduce((sum, p) => sum + p.methods.length, 0),
    totalProperties: processed.reduce((sum, p) => sum + p.properties.length, 0),
    componentTypes: [...new Set(processed.map(p => p.component_type).filter(Boolean))]
  };

  return { data: processed, stats };
}

async function saveResults(data, stats) {
  const timestamp = Date.now();
  const outputDir = path.join(process.cwd(), 'data', 'raw');

  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Save processed data
  const dataPath = path.join(outputDir, `crawl_${timestamp}.json`);
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));

  // Save statistics
  const statsPath = path.join(outputDir, `crawl_stats_${timestamp}.json`);
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));

  console.log(`\n💾 Data saved to: ${dataPath}`);
  console.log(`📊 Stats saved to: ${statsPath}`);

  return { dataPath, statsPath };
}

async function main() {
  // The crawl ID from our previous run
  const crawlId = process.argv[2] || '9513b614-7395-433b-8350-32d14d90ad90';

  console.log('🔄 Retrieving completed crawl data...\n');

  try {
    const result = await retrieveCrawlData(crawlId);
    const { data, stats } = result;

    console.log('\n📊 Crawl Statistics:');
    console.log(`   - Total Pages: ${stats.totalPages}`);
    console.log(`   - Total Methods: ${stats.totalMethods}`);
    console.log(`   - Total Properties: ${stats.totalProperties}`);
    console.log(`   - Component Types: ${stats.componentTypes.join(', ')}`);

    const { dataPath } = await saveResults(data, stats);

    console.log('\n✅ Successfully retrieved and saved crawl data!');
    console.log(`📁 Ready for processing: ${dataPath}`);

    return { success: true, dataPath, stats };

  } catch (error) {
    console.error('❌ Failed to retrieve crawl:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { retrieveCrawlData };