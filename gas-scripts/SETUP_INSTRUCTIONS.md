# Google Apps Script Setup Instructions

## Step 1: Create a New Google Apps Script Project

1. Go to https://script.google.com
2. Click "New Project"
3. Name it "GAS-RAG Vector Database"

## Step 2: Add the Script Files

1. Delete the default `Code.gs` file
2. Create new script files (File > New > Script):
   - `VectorDatabase.gs`
   - `WebApp.gs`
   - `SearchRAG.gs`
3. Copy the code from each file in the `gas-scripts` folder

## Step 3: Configure Your API Key

1. In the Apps Script editor, go to Project Settings (gear icon)
2. Scroll down to "Script Properties"
3. Click "Add script property"
4. Add:
   - Property: `GOOGLE_AI_KEY`
   - Value: `AIzaSyBdyciBDJm75IK42KM58wvupn4lwpWaEXE`

## Step 4: Run Initial Setup

1. In `WebApp.gs`, find the `initialSetup()` function
2. Update the GOOGLE_AI_KEY line with your key:
   ```javascript
   const GOOGLE_AI_KEY = 'AIzaSyBdyciBDJm75IK42KM58wvupn4lwpWaEXE';
   ```
3. Run the `initialSetup()` function
4. Authorize the permissions when prompted
5. Check the execution log for the Spreadsheet URL

## Step 5: Deploy as Web App

1. Click "Deploy" > "New Deployment"
2. Settings:
   - Type: Web app
   - Description: GAS-RAG API
   - Execute as: Me
   - Who has access: Anyone (or "Anyone with Google account" for more security)
3. Click "Deploy"
4. Copy the Web App URL (looks like: https://script.google.com/macros/s/...)

## Step 6: Update Your Local .env File

Add the Web App URL to your `.env` file:
```
SHEETS_WEBAPP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Step 7: Test the Setup

From your local terminal:
```bash
# Test if the Web App is accessible
curl "YOUR_WEB_APP_URL?action=status"
```

## What Each File Does:

- **VectorDatabase.gs**: Manages the Google Sheets storage
- **WebApp.gs**: Provides API endpoints for importing/searching
- **SearchRAG.gs**: Implements RAG search with Gemini 2.5 Flash

## Important URLs to Save:

1. **Google Sheets URL**: Created during setup (stores vectors)
2. **Web App URL**: From deployment (API endpoint)
3. **Script Project URL**: https://script.google.com/home/projects/YOUR_PROJECT_ID

## Next Steps:

After setup, you can:
1. Run `npm run pipeline` locally to crawl and generate embeddings
2. Import the embeddings to Google Sheets using the Web App
3. Search the documentation using the RAG system