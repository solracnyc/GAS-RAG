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
  const lock = LockService.getScriptLock();

  try {
    // Wait up to 30 seconds for exclusive access
    const acquired = lock.waitLock(30000);
    if (!acquired) {
      console.error('Could not acquire lock - server busy');
      return jsonResponse({
        error: 'Server busy - could not acquire lock',
        retryAfter: 5
      }, 503);
    }

    console.log(`POST request received with action: ${e.postData?.contents?.substring(0, 100)}`);

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    console.log(`Processing action: ${action}`);

    switch (action) {
      case 'import':
      case 'importChunks':  // Support both action names
        console.log(`Importing ${data.chunks?.length || 0} chunks`);
        const result = importChunks(data.chunks);

        // Force final flush before releasing lock
        SpreadsheetApp.flush();

        console.log(`Import result: ${JSON.stringify(result)}`);
        return jsonResponse({ success: true, ...result });

      case 'search':
        const searchResults = searchVectors(data.embedding, data.topK || 10);
        return jsonResponse({ results: searchResults });

      case 'generateEmbedding':
        const embedding = generateEmbedding(data.text, data.taskType);
        return jsonResponse({ embedding: embedding });

      default:
        console.error(`Unknown action: ${action}`);
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    console.error('doPost error:', error.toString());
    console.error('Stack:', error.stack);
    return jsonResponse({ error: error.message }, 500);
  } finally {
    // Always release the lock (no check needed - hasLock() has known reliability issues)
    lock.releaseLock();
    console.log('Lock released');
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
 * IMPORTANT: Add GOOGLE_AI_KEY to Script Properties FIRST before running this
 */
function initialSetup() {
  // Check if API key exists in Script Properties (secure storage)
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_AI_KEY');

  if (!apiKey) {
    throw new Error(
      'SECURITY: Please add GOOGLE_AI_KEY to Script Properties first!\n' +
      'Go to Project Settings → Script Properties → Add Property\n' +
      'Never hardcode API keys in your code!'
    );
  }

  // Create the vector database
  const url = setupVectorDatabase();

  Logger.log('Setup complete!');
  Logger.log('API Key: Securely loaded from Script Properties');
  Logger.log('Spreadsheet URL: ' + url);
  Logger.log('Next: Deploy as Web App and copy the URL');
}