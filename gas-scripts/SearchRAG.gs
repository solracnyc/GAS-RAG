/**
 * RAG Search with Gemini 2.5 Flash
 * Provides intelligent search and synthesis
 */

/**
 * Search and synthesize answer using Gemini 2.5 Flash
 */
function searchWithRAG(query) {
  try {
    // Generate query embedding
    const queryEmbedding = generateEmbedding(query, 'RETRIEVAL_QUERY');

    // Search for similar vectors
    const searchResults = searchVectors(queryEmbedding, 10);

    if (searchResults.length === 0) {
      return {
        answer: 'No relevant documentation found for your query.',
        sources: []
      };
    }

    // Synthesize answer with Gemini 2.5 Flash
    return synthesizeAnswer(query, searchResults);

  } catch (error) {
    Logger.log('Search error: ' + error.message);
    return {
      answer: 'An error occurred during search: ' + error.message,
      sources: [],
      error: true
    };
  }
}

/**
 * Synthesize answer using Gemini 2.5 Flash
 */
function synthesizeAnswer(query, searchResults) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_AI_KEY');

  // Build context from search results
  let context = searchResults.map((result, index) => {
    let contextBlock = `--- Result ${index + 1} (Relevance: ${(result.similarity * 100).toFixed(1)}%) ---\n`;

    if (result.methodSignature) {
      contextBlock += `Method: ${result.methodSignature}\n`;
    }
    if (result.componentType) {
      contextBlock += `Component: ${result.componentType}\n`;
    }
    contextBlock += `Source: ${result.sourceUrl}\n\n`;
    contextBlock += result.content;

    return contextBlock;
  }).join('\n\n');

  const prompt = `Based on the following Google Apps Script documentation, provide a comprehensive answer to this question:

Question: ${query}

Documentation Context:
${context}

Instructions:
1. Provide a clear, direct answer to the question
2. Include relevant code examples from the documentation
3. Mention specific methods or classes when applicable
4. If multiple approaches exist, explain the differences
5. Keep the response concise but complete`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
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
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200) {
      const answer = result.candidates[0].content.parts[0].text;

      return {
        answer: answer,
        sources: searchResults.slice(0, 3).map(r => ({
          url: r.sourceUrl,
          method: r.methodSignature,
          relevance: r.similarity
        })),
        model: 'gemini-2.5-flash-preview-09-2025'
      };
    } else {
      throw new Error(result.error?.message || 'Unknown error');
    }
  } catch (error) {
    Logger.log('Synthesis error: ' + error.message);

    // Fallback to best search result
    return {
      answer: searchResults[0].content,
      sources: [searchResults[0]],
      fallback: true,
      error: error.message
    };
  }
}

/**
 * Test search function
 */
function testSearch() {
  const testQuery = "How do I create a Google Sheets spreadsheet programmatically?";
  const result = searchWithRAG(testQuery);

  Logger.log('Query: ' + testQuery);
  Logger.log('Answer: ' + result.answer);
  Logger.log('Sources: ' + JSON.stringify(result.sources));

  return result;
}

/**
 * Batch search multiple queries
 */
function batchSearch(queries) {
  const results = [];

  queries.forEach(query => {
    Logger.log(`Processing query: ${query}`);
    const result = searchWithRAG(query);
    results.push({
      query: query,
      ...result
    });

    // Rate limiting
    Utilities.sleep(1000);
  });

  return results;
}

/**
 * Get popular searches from cache
 */
function getPopularSearches() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('VECTOR_DB_ID')
  );
  const cacheSheet = ss.getSheetByName('Cache');
  const data = cacheSheet.getDataRange().getValues();

  // Skip header and sort by hit count
  const searches = data.slice(1)
    .filter(row => row[0]) // Has query
    .sort((a, b) => b[3] - a[3]) // Sort by hit count
    .slice(0, 10)
    .map(row => ({
      query: row[0],
      lastAccessed: row[2],
      hitCount: row[3]
    }));

  return searches;
}