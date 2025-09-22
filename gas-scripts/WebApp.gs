/**
 * Google Apps Script Web App
 * Provides API endpoints for the GAS-RAG system
 */

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action || 'status';

  try {
    switch (action) {
      case 'status':
        return jsonResponse(getDatabaseStats());

      case 'setup':
        const url = setupVectorDatabase();
        return jsonResponse({ success: true, url: url });

      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'import':
        const result = importChunks(data.chunks);
        return jsonResponse({ success: true, ...result });

      case 'search':
        const searchResults = searchVectors(data.embedding, data.topK || 10);
        return jsonResponse({ results: searchResults });

      case 'generateEmbedding':
        const embedding = generateEmbedding(data.text, data.taskType);
        return jsonResponse({ embedding: embedding });

      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Generate embedding using Gemini API
 */
function generateEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_AI_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured in Script Properties');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const payload = {
    model: "models/gemini-embedding-001",
    content: {
      parts: [{ text: text.substring(0, 2048) }]
    },
    taskType: taskType,
    outputDimensionality: 768
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() === 200) {
    return result.embedding.values;
  } else {
    throw new Error(`Embedding generation failed: ${result.error?.message}`);
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initial setup function to run manually
 */
function initialSetup() {
  // Set your Google AI key here
  const GOOGLE_AI_KEY = 'YOUR_KEY_HERE';

  PropertiesService.getScriptProperties().setProperty('GOOGLE_AI_KEY', GOOGLE_AI_KEY);

  // Create the vector database
  const url = setupVectorDatabase();

  Logger.log('Setup complete!');
  Logger.log('Spreadsheet URL: ' + url);
  Logger.log('Next: Deploy as Web App and copy the URL');
}