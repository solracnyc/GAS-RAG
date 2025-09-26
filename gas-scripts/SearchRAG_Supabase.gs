/**
 * RAG Search with Supabase pgvector and Gemini 2.5 Pro
 * Enhanced version using Supabase for vector storage
 */

/**
 * Main RAG search function using Supabase
 */
function searchWithSupabaseRAG(query) {
  try {
    // Initialize Supabase connector
    const connector = getSupabaseConnector();

    // Generate query embedding
    console.log('Generating query embedding...');
    const queryEmbedding = generateEmbedding(query, 'RETRIEVAL_QUERY');

    // Search for similar vectors in Supabase
    console.log('Searching Supabase for similar documents...');
    const searchResults = connector.searchVectors(queryEmbedding, {
      matchThreshold: 0.75,
      matchCount: 10
    });

    if (!searchResults || searchResults.length === 0) {
      return {
        answer: 'No relevant documentation found for your query.',
        sources: [],
        model: 'no-results'
      };
    }

    console.log(`Found ${searchResults.length} relevant documents`);

    // Synthesize answer with Gemini 2.5 Pro
    return synthesizeAnswerWithGemini(query, searchResults);

  } catch (error) {
    console.error('Supabase RAG search error:', error.toString());
    return {
      answer: 'An error occurred during search: ' + error.toString(),
      sources: [],
      error: true,
      errorDetails: error.toString()
    };
  }
}

/**
 * Hybrid search combining vector and text search
 */
function hybridSupabaseRAG(query) {
  try {
    const connector = getSupabaseConnector();

    // Generate query embedding
    const queryEmbedding = generateEmbedding(query, 'RETRIEVAL_QUERY');

    // Perform hybrid search
    console.log('Performing hybrid search...');
    const searchResults = connector.hybridSearch(query, queryEmbedding, {
      matchThreshold: 0.7,
      matchCount: 10,
      vectorWeight: 0.7,
      textWeight: 0.3
    });

    if (!searchResults || searchResults.length === 0) {
      return {
        answer: 'No relevant documentation found for your query.',
        sources: [],
        model: 'no-results'
      };
    }

    // Synthesize answer
    return synthesizeAnswerWithGemini(query, searchResults);

  } catch (error) {
    console.error('Hybrid search error:', error.toString());
    return {
      answer: 'An error occurred during hybrid search: ' + error.toString(),
      sources: [],
      error: true
    };
  }
}

/**
 * Synthesize answer using Gemini 2.5 Pro
 */
function synthesizeAnswerWithGemini(query, searchResults) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_AI_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured in Script Properties');
  }

  // Build context from search results
  let context = searchResults.map((result, index) => {
    let contextBlock = `--- Result ${index + 1} (Relevance: ${((result.similarity || result.combined_score) * 100).toFixed(1)}%) ---\n`;

    // Add metadata if available
    if (result.metadata) {
      if (result.metadata.method_signature) {
        contextBlock += `Method: ${result.metadata.method_signature}\n`;
      }
      if (result.metadata.component_type) {
        contextBlock += `Component: ${result.metadata.component_type}\n`;
      }
    }

    if (result.document_url) {
      contextBlock += `Source: ${result.document_url}\n`;
    }

    contextBlock += '\n' + result.chunk_content;
    return contextBlock;
  }).join('\n\n');

  // Create the prompt
  const prompt = `Based on the following Google Apps Script documentation, provide a comprehensive answer to this question:

Question: ${query}

Documentation Context:
${context}

Instructions:
1. Provide a clear, direct answer to the question
2. Include relevant code examples from the documentation when applicable
3. Mention specific methods or classes when relevant
4. If multiple approaches exist, explain the differences
5. Keep the response concise but complete
6. Format code examples properly using markdown code blocks`;

  // Call Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topP: 0.95,
      topK: 40
    }
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      const answer = result.candidates[0].content.parts[0].text;

      // Prepare sources
      const sources = searchResults.slice(0, 3).map(r => ({
        url: r.document_url || 'N/A',
        title: r.document_title || 'Untitled',
        relevance: (r.similarity || r.combined_score || 0).toFixed(3),
        preview: r.chunk_content.substring(0, 200) + '...'
      }));

      return {
        answer: answer,
        sources: sources,
        model: 'gemini-2.5-pro',
        totalResults: searchResults.length,
        processingTime: new Date().toISOString()
      };

    } else {
      const errorData = JSON.parse(responseText);
      throw new Error(errorData.error?.message || 'Unknown API error');
    }

  } catch (error) {
    console.error('Synthesis error:', error.toString());

    // Fallback to best search result
    const fallbackAnswer = searchResults[0].chunk_content;
    return {
      answer: fallbackAnswer,
      sources: [{
        url: searchResults[0].document_url || 'N/A',
        relevance: searchResults[0].similarity || 0
      }],
      model: 'fallback',
      fallbackReason: error.toString(),
      error: error.toString()
    };
  }
}

/**
 * Batch search multiple queries
 */
function batchSupabaseSearch(queries) {
  const results = [];
  const connector = getSupabaseConnector();

  queries.forEach((query, index) => {
    console.log(`Processing query ${index + 1}/${queries.length}: ${query}`);

    try {
      const result = searchWithSupabaseRAG(query);
      results.push({
        query: query,
        ...result,
        index: index
      });
    } catch (error) {
      results.push({
        query: query,
        answer: 'Error processing query',
        error: error.toString(),
        index: index
      });
    }

    // Rate limiting
    if (index < queries.length - 1) {
      Utilities.sleep(1000);
    }
  });

  return results;
}

/**
 * Get search statistics
 */
function getSearchStats() {
  try {
    const connector = getSupabaseConnector();
    const stats = connector.getDatabaseStats();

    return {
      databaseStats: stats,
      searchCapabilities: {
        vectorSearch: true,
        hybridSearch: true,
        maxResults: 100,
        embeddingDimensions: 768,
        similarityMetric: 'cosine'
      },
      performance: {
        expectedLatency: '<15ms',
        throughput: '20-50 QPS',
        cacheEnabled: true
      }
    };

  } catch (error) {
    return {
      error: error.toString(),
      status: 'Error retrieving statistics'
    };
  }
}

/**
 * Test the complete RAG pipeline
 */
function testSupabaseRAGPipeline() {
  const testQueries = [
    "How do I create a Google Sheets spreadsheet programmatically?",
    "What's the difference between getRange and getRanges?",
    "How do I send an email with attachments using GmailApp?",
    "What are script properties and how do I use them?",
    "How can I create a custom menu in Google Sheets?"
  ];

  console.log('Testing Supabase RAG Pipeline...\n');

  // Test connection
  const connector = getSupabaseConnector();
  const health = connector.healthCheck();
  console.log('Connection health:', JSON.stringify(health, null, 2));

  if (health.status !== 'healthy') {
    console.error('Unhealthy connection, aborting tests');
    return;
  }

  // Test each query
  const results = [];
  testQueries.forEach((query, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    console.log(`Query: ${query}`);

    const startTime = new Date().getTime();
    const result = searchWithSupabaseRAG(query);
    const endTime = new Date().getTime();

    console.log(`Processing time: ${endTime - startTime}ms`);
    console.log(`Sources found: ${result.sources ? result.sources.length : 0}`);
    console.log(`Answer length: ${result.answer ? result.answer.length : 0} chars`);

    results.push({
      query: query,
      processingTime: endTime - startTime,
      sourcesCount: result.sources ? result.sources.length : 0,
      answerLength: result.answer ? result.answer.length : 0,
      model: result.model,
      success: !result.error
    });
  });

  // Summary
  console.log('\n=== Test Summary ===');
  const successCount = results.filter(r => r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

  console.log(`Success rate: ${successCount}/${results.length}`);
  console.log(`Average processing time: ${avgTime.toFixed(0)}ms`);

  return {
    summary: {
      totalTests: results.length,
      successful: successCount,
      averageTime: avgTime
    },
    results: results
  };
}

/**
 * Compatibility wrapper for existing code
 */
function searchWithRAG(query) {
  // Redirect to Supabase version
  return searchWithSupabaseRAG(query);
}