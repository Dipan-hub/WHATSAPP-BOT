// src/googlesheetoperation.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function loadCredentials() {
  console.log("Loading credentials...");
  if (process.env.GOOGLE_CREDENTIALS) {
    console.log("Found GOOGLE_CREDENTIALS in environment variables.");
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (err) {
      console.error("Error parsing GOOGLE_CREDENTIALS:", err);
      process.exit(1);
    }
  } else {
    const localPath = path.join(__dirname, '../credentials.json');
    console.log("GOOGLE_CREDENTIALS not set; loading local credentials from:", localPath);
    try {
      const rawData = fs.readFileSync(localPath);
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading local credentials.json:", err);
      process.exit(1);
    }
  }
}

async function getSheetsClient() {
  console.log("Authenticating with Google API...");
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  try {
    const authClient = await auth.getClient();
    console.log("Authentication successful.");
    return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
    console.error("Error during authentication:", error);
    throw error;
  }
}
async function addRowToSheet(rowData, spreadsheetId) {
  try {
    const sheets = await getSheetsClient();
    const range = 'Sheet1!A:D'; // Ensure this is correct based on your sheet structure
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    console.log('Google Sheet updated:', result.data.updates);
    return result.data;
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
    throw error;
  }
}

module.exports = {
  getSheetsClient,
  addRowToSheet
};
