const crypto = require('crypto');

/**
 * Smart document chunker for structured data
 * Optimized for Google Apps Script documentation
 */
class DocumentChunker {
  constructor(config = {}) {
    this.chunkSize = config.chunkSize || parseInt(process.env.CHUNK_SIZE) || 450;
    this.overlap = config.overlap || parseInt(process.env.CHUNK_OVERLAP) || 68;
  }

  /**
   * Process a single page into chunks
   */
  processPage(pageData) {
    const chunks = [];
    const pageContext = this.createPageContext(pageData);

    // Process properties as a single chunk
    if (pageData.properties && pageData.properties.length > 0) {
      chunks.push(this.createPropertyChunk(pageData.properties, pageContext, pageData.url));
    }

    // Process each method as a separate chunk
    if (pageData.methods && pageData.methods.length > 0) {
      pageData.methods.forEach(method => {
        chunks.push(this.createMethodChunk(
          method,
          pageContext,
          pageData.url,
          pageData.component_type
        ));
      });
    }

    // Process markdown content
    if (pageData.markdown) {
      const markdownChunks = this.chunkMarkdown(
        pageData.markdown,
        pageData.url
      );
      chunks.push(...markdownChunks);
    }

    return chunks;
  }

  /**
   * Create page context header
   */
  createPageContext(pageData) {
    return `# ${pageData.title}
Component Type: ${pageData.component_type || 'Documentation'}
URL: ${pageData.url}`.trim();
  }

  /**
   * Create property chunk
   */
  createPropertyChunk(properties, pageContext, url) {
    let content = `${pageContext}\n\n## Properties\n\n`;

    properties.forEach(prop => {
      content += `### ${prop.property_name}\n`;
      content += `- **Type:** ${prop.type}\n`;
      content += `- **Description:** ${prop.description}\n\n`;
    });

    return {
      id: this.generateId(url, 'properties'),
      content: content.trim(),
      metadata: {
        source_url: url,
        chunk_type: 'properties',
        property_count: properties.length,
        property_names: properties.map(p => p.property_name)
      }
    };
  }

  /**
   * Create method chunk with rich metadata
   */
  createMethodChunk(method, pageContext, url, componentType) {
    let content = `${pageContext}\n\n## Method: ${method.signature}\n\n`;
    content += `${method.description || 'No description available'}\n\n`;

    if (method.parameters && method.parameters.length > 0) {
      content += `### Parameters:\n`;
      method.parameters.forEach(param => {
        content += `- **${param.param_name}** (${param.type}): ${param.description}\n`;
      });
      content += '\n';
    }

    if (method.return_type) {
      content += `### Returns:\n${method.return_type}\n\n`;
    }

    if (method.code_example) {
      content += `### Example:\n\`\`\`javascript\n${method.code_example}\n\`\`\`\n`;
    }

    return {
      id: this.generateId(url, method.signature),
      content: content.trim(),
      metadata: {
        source_url: url,
        chunk_type: 'method',
        component_type: componentType,
        method_signature: method.signature,
        method_name: method.signature.split('(')[0],
        has_parameters: method.parameters && method.parameters.length > 0,
        has_example: !!method.code_example,
        return_type: method.return_type
      }
    };
  }

  /**
   * Chunk markdown content intelligently
   */
  chunkMarkdown(markdown, url) {
    const chunks = [];
    const sections = this.splitIntoSections(markdown);

    sections.forEach((section, index) => {
      if (this.estimateTokens(section) > this.chunkSize * 3) {
        // Large section - split further
        const subChunks = this.splitLargeText(section);
        subChunks.forEach((subChunk, subIndex) => {
          chunks.push({
            id: this.generateId(url, `section_${index}_${subIndex}`),
            content: subChunk,
            metadata: {
              source_url: url,
              chunk_type: 'documentation',
              section_index: index,
              sub_index: subIndex,
              has_code: subChunk.includes('```')
            }
          });
        });
      } else {
        // Small enough to be a single chunk
        chunks.push({
          id: this.generateId(url, `section_${index}`),
          content: section,
          metadata: {
            source_url: url,
            chunk_type: 'documentation',
            section_index: index,
            has_code: section.includes('```')
          }
        });
      }
    });

    return chunks;
  }

  /**
   * Split markdown into logical sections
   */
  splitIntoSections(markdown) {
    // Split on headers while preserving them
    const sections = markdown.split(/(?=^#{1,3} )/gm);
    return sections.filter(s => s.trim().length > 0);
  }

  /**
   * Split large text with overlap
   */
  splitLargeText(text) {
    const words = text.split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += this.chunkSize - this.overlap) {
      const chunkWords = words.slice(i, i + this.chunkSize);
      if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(' '));
      }
    }

    return chunks;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique chunk ID
   */
  generateId(url, identifier) {
    const hash = crypto.createHash('md5');
    hash.update(`${url}_${identifier}`);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Process multiple pages
   */
  processPages(pages) {
    const allChunks = [];
    let stats = {
      totalPages: pages.length,
      totalChunks: 0,
      chunkTypes: {}
    };

    pages.forEach((page, index) => {
      if ((index + 1) % 10 === 0) {
        console.log(`Processing page ${index + 1}/${pages.length}...`);
      }

      const pageChunks = this.processPage(page);
      allChunks.push(...pageChunks);

      // Update statistics
      pageChunks.forEach(chunk => {
        const type = chunk.metadata.chunk_type;
        stats.chunkTypes[type] = (stats.chunkTypes[type] || 0) + 1;
      });
    });

    stats.totalChunks = allChunks.length;

    console.log('\n📊 Chunking Statistics:');
    console.log(`   - Total Chunks: ${stats.totalChunks}`);
    console.log(`   - Average chunks per page: ${(stats.totalChunks / stats.totalPages).toFixed(1)}`);
    Object.entries(stats.chunkTypes).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    return { chunks: allChunks, stats };
  }
}

module.exports = DocumentChunker;