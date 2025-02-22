// googleSheetOperation.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

// Function to load credentials: use env variable if available, otherwise fallback to local file.
function loadCredentials() {
  console.log("Loading credentials...");

  if (process.env.GOOGLE_CREDENTIALS) {
    console.log("Found GOOGLE_CREDENTIALS in environment variables.");
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (err) {
      console.error("Error parsing GOOGLE_CREDENTIALS from env:", err);
      process.exit(1);
    }
  } else {
    // For local development only - ensure this file is in .gitignore!
    const localPath = path.join(__dirname, '../credentials.json');
    console.log("GOOGLE_CREDENTIALS not set in env, trying local file:", localPath);
    try {
      const rawData = fs.readFileSync(localPath);
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading local credentials.json:", err);
      process.exit(1);
    }
  }
}

// Function to authenticate with Google APIs
async function authenticate() {
  console.log("Authenticating with Google API...");
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  try {
    const authClient = await auth.getClient();
    console.log("Authentication successful.");
    return authClient;
  } catch (error) {
    console.error("Error during authentication:", error);
    throw error;
  }
}

// Function that reads data from the source sheet and appends it to the target sheet.
async function performSheetOperation() {
  console.log("Starting performSheetOperation...");

  if (!USER_SHEET_ID || !VENDOR_SHEET_ID) {
    console.error("Error: USER_SHEET_ID and/or VENDOR_SHEET_ID are not set in environment variables.");
    process.exit(1);
  }
  console.log(`USER_SHEET_ID: ${USER_SHEET_ID}`);
  console.log(`VENDOR_SHEET_ID: ${VENDOR_SHEET_ID}`);

  const authClient = await authenticate();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Step 1: Read data from the source sheet (assume data is in "Sheet1")
  console.log("Fetching data from source sheet (Sheet1)...");
  let sourceData;
  try {
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1', // Modify if your sheet name or range differs
    });
    sourceData = getRes.data.values;
    console.log("Data fetched from source sheet:", sourceData);
  } catch (error) {
    console.error("Error fetching data from source sheet:", error);
    throw error;
  }

  if (!sourceData || sourceData.length === 0) {
    console.log("No data found in the source sheet.");
    return;
  }

  // Step 2: Append the fetched data to the target sheet ("Sheet1")
  console.log("Appending data to target sheet (Sheet1)...");
  try {
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet1', // Modify if needed
      valueInputOption: 'RAW', // Use 'USER_ENTERED' if you want Sheets to parse the values
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: sourceData,
      },
    });
    console.log("Data appended successfully:", appendRes.data);
  } catch (error) {
    console.error("Error appending data to target sheet:", error);
    throw error;
  }
}

module.exports = {
  performSheetOperation,
};
