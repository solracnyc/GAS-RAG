require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

/**
 * Firecrawl v2 Crawler for Google Apps Script Documentation
 * Clean, modular implementation with proper error handling
 */
class FirecrawlCrawler {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.FIRECRAWL_API_KEY;
    this.baseUrl = 'https://api.firecrawl.dev/v2';
    this.crawlLimit = config.crawlLimit || parseInt(process.env.CRAWL_LIMIT) || 1500;
    this.maxDepth = config.maxDepth || parseInt(process.env.MAX_DEPTH) || 10;
    this.waitBetweenRequests = config.waitBetweenRequests || parseInt(process.env.WAIT_BETWEEN_REQUESTS) || 1000;
  }

  /**
   * Build crawl configuration for Google Apps Script docs
   */
  buildCrawlConfig() {
    return {
      url: "https://developers.google.com/apps-script/",
      // Crawl-level options at root
      limit: this.crawlLimit,
      includePaths: [
        "/apps-script/reference/.*",
        "/apps-script/advanced/.*",
        "/apps-script/guides/.*",
        "/apps-script/samples/.*"
      ],
      excludePaths: [".*\\?hl=.*"], // Exclude language variants

      // Scraping options wrapped in scrapeOptions
      scrapeOptions: {
        formats: ["markdown"], // Simplified for now - just markdown
        onlyMainContent: true,
        timeout: 15000
      }
    };
  }

  /**
   * Get structured extraction schema
   */
  getStructuredSchema() {
    return {
      type: "object",
      properties: {
        page_title: { type: "string" },
        page_description: { type: "string" },
        component_type: {
          type: "string",
          description: "Is this a Class, Service, or Enum?"
        },
        properties: {
          type: "array",
          items: {
            type: "object",
            properties: {
              property_name: { type: "string" },
              type: { type: "string" },
              description: { type: "string" }
            }
          }
        },
        methods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signature: {
                type: "string",
                description: "Full method signature like 'create(name, rows, columns)'"
              },
              description: { type: "string" },
              parameters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    param_name: { type: "string" },
                    type: { type: "string" },
                    description: { type: "string" }
                  }
                }
              },
              return_type: { type: "string" },
              code_example: { type: "string" }
            }
          }
        }
      }
    };
  }

  /**
   * Initiate crawl with Firecrawl v2
   */
  async initiateCrawl() {
    const url = `${this.baseUrl}/crawl`;
    const config = this.buildCrawlConfig();

    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Response:', JSON.stringify(data, null, 2));
        throw new Error(`API Error ${response.status}: ${data.error || data.details?.[0]?.message || 'Unknown error'}`);
      }

      if (data.id) {
        console.log(`✅ Crawl initiated successfully!`);
        console.log(`   Crawl ID: ${data.id}`);
        console.log(`   Status: ${data.status}`);
        return data.id;
      }

      throw new Error('No crawl ID received');
    } catch (error) {
      console.error('❌ Failed to initiate crawl:', error.message);
      throw error;
    }
  }

  /**
   * Monitor crawl status with exponential backoff
   */
  async monitorCrawl(crawlId, options = {}) {
    const maxAttempts = options.maxAttempts || 120; // 10 minutes max
    const pollInterval = options.pollInterval || 5000; // 5 seconds
    let attempts = 0;

    console.log('\n📊 Monitoring crawl progress...\n');

    while (attempts < maxAttempts) {
      try {
        const status = await this.checkCrawlStatus(crawlId);

        // Display progress
        this.displayProgress(status);

        if (status.status === 'completed') {
          console.log('\n✅ Crawl completed successfully!');
          return status.data || await this.retrieveCrawlData(crawlId);
        }

        if (status.status === 'failed') {
          throw new Error(`Crawl failed: ${status.error || 'Unknown error'}`);
        }

        await this.sleep(pollInterval);
        attempts++;
      } catch (error) {
        if (error.message.includes('429')) {
          // Rate limiting - exponential backoff
          const backoff = Math.min(pollInterval * Math.pow(2, attempts / 10), 30000);
          console.log(`⏳ Rate limited. Waiting ${backoff / 1000}s...`);
          await this.sleep(backoff);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Crawl timeout - exceeded maximum wait time');
  }

  /**
   * Check crawl status
   */
  async checkCrawlStatus(crawlId) {
    const url = `${this.baseUrl}/crawl/${crawlId}`;

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Display crawl progress
   */
  displayProgress(status) {
    const completed = status.completed || 0;
    const total = status.total || 0;
    const credits = status.creditsUsed || 0;
    const percentage = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    process.stdout.write(`\r📄 Progress: ${completed}/${total} pages (${percentage}%) | Credits: ${credits}`);
  }

  /**
   * Process crawled data
   */
  processCrawlData(rawData) {
    const processed = rawData.map(page => {
      // Handle v2 response structure where JSON is in formats array
      let structuredData = {};

      // Check if we have structured data in the new format
      if (page.formats && Array.isArray(page.formats)) {
        const jsonFormat = page.formats.find(f => f.type === 'json');
        if (jsonFormat && jsonFormat.data) {
          structuredData = jsonFormat.data;
        }
      } else if (page.json) {
        // Fallback to direct json field if it exists
        structuredData = page.json;
      } else if (page.extract) {
        // Another possible location in v2
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

  /**
   * Save crawl results
   */
  async saveResults(data, stats) {
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

  /**
   * Run complete crawl pipeline
   */
  async run() {
    console.log('🚀 Starting Google Apps Script Documentation Crawl\n');
    console.log(`   Configuration:`);
    console.log(`   - Limit: ${this.crawlLimit} pages`);
    console.log(`   - Max Depth: ${this.maxDepth}`);
    console.log(`   - Wait Between Requests: ${this.waitBetweenRequests}ms\n`);

    const startTime = Date.now();

    try {
      // Step 1: Initiate crawl
      const crawlId = await this.initiateCrawl();

      // Step 2: Monitor progress
      const rawData = await this.monitorCrawl(crawlId);

      // Step 3: Process data
      const { data, stats } = this.processCrawlData(rawData);

      // Step 4: Display statistics
      console.log('\n\n📊 Crawl Statistics:');
      console.log(`   - Total Pages: ${stats.totalPages}`);
      console.log(`   - Total Methods: ${stats.totalMethods}`);
      console.log(`   - Total Properties: ${stats.totalProperties}`);
      console.log(`   - Component Types: ${stats.componentTypes.join(', ')}`);

      // Step 5: Save results
      const { dataPath } = await this.saveResults(data, stats);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n✅ Crawl completed in ${duration} seconds`);

      return { data, stats, dataPath };
    } catch (error) {
      console.error('\n❌ Crawl failed:', error.message);
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
  const crawler = new FirecrawlCrawler();
  crawler.run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = FirecrawlCrawler;