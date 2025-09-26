# Google Apps Script Deployment Guide

## Critical Updates (Sept 2025)

This guide includes **critical fixes** for the data persistence issue where vectors weren't being saved to Google Sheets despite successful execution logs.

## Files to Update

You need to update these two files in your Google Apps Script project:

1. **VectorDatabase.gs** - Contains the vector storage logic
2. **WebApp.gs** - Contains the API endpoints

## Step-by-Step Deployment

### 1. Open Your Google Apps Script Project

Go to your existing GAS project or create a new one at [script.google.com](https://script.google.com)

### 2. Update VectorDatabase.gs

Copy the entire contents of `gas-scripts/VectorDatabase.gs` and replace your existing file.

**Critical changes in this file:**
- Line 160: Added `SpreadsheetApp.flush()` after writing data
- Line 210: Added `SpreadsheetApp.flush()` in updateMetadata
- Lines 73-152: Added comprehensive error handling and logging
- Lines 163-175: Added write verification

### 3. Update WebApp.gs

Copy the entire contents of `gas-scripts/WebApp.gs` and replace your existing file.

**Critical changes in this file:**
- Line 33: Added `LockService` for concurrent safety
- Line 60: Added extra `SpreadsheetApp.flush()`
- Lines 46-85: Added extensive logging
- Line 37-43: Added lock acquisition with timeout

### 4. Set Script Properties

Go to **Project Settings** → **Script Properties** and ensure these are set:

- `GOOGLE_AI_KEY`: Your Google AI Studio API key
- `VECTOR_DB_ID`: The ID of your vector database spreadsheet (auto-set by initialSetup)

### 5. Deploy as Web App

1. Click **Deploy** → **New Deployment**
2. Configure:
   - **Type**: Web App
   - **Description**: "Vector Database API v2 - Fixed"
   - **Execute as**: **Me** (your account)
   - **Who has access**: **Anyone, even anonymous**
3. Click **Deploy**
4. Copy the Web App URL

### 6. Update Your Local Configuration

Update the Web App URL in these files if it changed:
- `.env` file: `SHEETS_WEBAPP_URL=<new_url>`
- `upload-embeddings.js`: Line 11
- `test-upload-small.js`: Line 12
- `test-webapp.js`: Line 9

### 7. Test the Deployment

Run the test script to verify everything works:

```bash
# Test with 5 chunks
node test-upload-small.js
```

You should see:
- Server responds with success
- Chunks are imported (imported > 0)
- Total count increases
- No errors in the response

### 8. View Logs (Important!)

To see the detailed logs from the new logging:

1. In Apps Script, click **Executions** in the left panel
2. Click on any execution to see details
3. Click **Show logs** to see console output
4. Look for:
   - "Flushed X rows to sheet" - Confirms data was committed
   - "Write verification successful" - Confirms data was saved
   - "Last chunk ID verified" - Shows the actual data

### 9. Full Upload

Once the test succeeds, run the full upload:

```bash
node upload-embeddings.js
```

Monitor the output for:
- Successful batch imports
- Actual vs expected import counts
- Total chunks in sheet increasing

## Troubleshooting

### If chunks still aren't saving:

1. **Check Web App deployment settings** - Must be "Execute as: Me" and "Anyone, even anonymous"
2. **Redeploy the Web App** - Click Deploy → Manage Deployments → Edit → New Version
3. **Check Script Properties** - Ensure VECTOR_DB_ID is set
4. **View Cloud Logs** - Enable Cloud Logging in project settings for detailed logs
5. **Test with curl**:
   ```bash
   curl -L -X POST -H "Content-Type: application/json" \
     -d '{"action":"importChunks","chunks":[{"id":"test1","content":"test","embedding":[0.1,0.2]}]}' \
     "YOUR_WEB_APP_URL"
   ```

### Critical Success Indicators:

✅ Response includes `"success": true`
✅ Response shows `"imported": <number>` greater than 0
✅ Response shows `"total": <number>` increasing
✅ Google Sheet shows data in rows (not just metadata)
✅ Logs show "Flushed X rows to sheet"

## Why These Changes Fix the Issue

1. **SpreadsheetApp.flush()** - Forces Google Apps Script to commit batched operations immediately instead of waiting for function completion
2. **LockService** - Prevents concurrent requests from corrupting data
3. **Smaller batch size** - Avoids memory limits and JSON parsing failures
4. **Write verification** - Confirms data actually persisted to the sheet
5. **Comprehensive logging** - Makes debugging possible with visibility into each step

Without these changes, Google Apps Script would batch all spreadsheet operations in memory but never commit them, causing the "phantom data loss" where execution logs showed success but no data was saved.