// src/offerOperation.js
const { getSheetsClient } = require('./googleSheetOperation.js');
const { sendWhatsAppMessage } = require('./whatsapp');

// IDs for the two sheets are set as environment variables.
const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

/**
 * Parse the incoming message and extract S_ID, OfferName, and OfferID.
 * Expected message sample:
 *
 *   Hi,
 *   
 *   This side whytoworry 
 *   S_ID: 534 
 *   OfferName: Testing the Test
 *   OfferID: 54
 *
 * @param {string} msgBody - The message body.
 * @returns {object} An object with { sId, offerName, offerId }.
 */
function parseMessage(msgBody) {
  const sIdMatch = msgBody.match(/S_ID:\s*(\d+)/i);
  const offerNameMatch = msgBody.match(/OfferName:\s*(.+)/i);
  const offerIdMatch = msgBody.match(/OfferID:\s*(\d+)/i);

  if (!sIdMatch || !offerNameMatch || !offerIdMatch) {
    throw new Error("Message format is incorrect. Could not parse required fields.");
  }

  return {
    sId: sIdMatch[1].trim(),
    offerName: offerNameMatch[1].trim(),
    offerId: offerIdMatch[1].trim(),
  };
}

/**
 * Generates a unique 6-digit (or more complex) code based on input parameters.
 * For demonstration, we combine parts of the offerId, sId, phone and add random letters.
 * @param {string} offerId 
 * @param {string} sId 
 * @param {string} phone 
 * @returns {string} A generated code.
 */
function generateCode(offerId, sId, phone) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${offerId}${sId}${phone.slice(-4)}${randomPart}`;
}

/**
 * Main function to handle an offer message.
 * It:
 *  1. Parses the message.
 *  2. Reads the current data from the user sheet.
 *  3. Appends a new row for the incoming message.
 *  4. Checks the vendor sheet for the MIN value for this offer.
 *  5. If the count of rows for this S_ID & OfferName reaches or exceeds MIN,
 *     it generates a code and updates unconfirmed rows.
 *  6. Sends WhatsApp messages to the new user (if applicable) and vendor.
 *
 * @param {string} from - The phone number of the sender.
 * @param {string} msgBody - The incoming message body.
 */
async function handleSrijanOffer(from, msgBody) {
  console.log("Handling offer message from:", from);
  
  // 1. Parse the message
  let parsed;
  try {
    parsed = parseMessage(msgBody);
    console.log("Parsed message:", parsed);
  } catch (error) {
    console.error("Failed to parse message:", error.message);
    return;
  }

  // 2. Get Google Sheets client
  const sheets = await getSheetsClient();

  // 3. Read the current data from the user sheet (assume data starts at row 2)
  let userData = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A2:H',  // Assuming columns: Sno, S_ID, OfferID, OfferName, PhoneNumber, UserName, Confirm, Code
    });
    userData = res.data.values || [];
    console.log("Current user sheet data:", userData);
  } catch (error) {
    console.error("Error reading user sheet:", error);
    return;
  }

  // 4. Determine next serial number (Sno) and uniqueness
  let nextSno = 1;
  if (userData.length > 0) {
    // Assuming Sno is in the first column
    const snoNumbers = userData.map(row => parseInt(row[0], 10)).filter(n => !isNaN(n));
    nextSno = Math.max(...snoNumbers);
    // Check if any row already exists for this S_ID (we consider them as part of the same group)
    const groupExists = userData.find(row => row[1] === parsed.sId);
    if (!groupExists) {
      nextSno++; // New group, increase serial number.
    }
  }

  // 5. Append the new row
  // Assume: [Sno, S_ID, OfferID, OfferName, PhoneNumber, UserName, Confirm, Code]
  // For simplicity, we extract UserName from the first line of the message (e.g. "This side whytoworry")
  const userNameMatch = msgBody.split('\n').find(line => line.trim().length > 0 && !line.includes("S_ID"));
  const userName = userNameMatch ? userNameMatch.trim() : "Unknown";
  const newRow = [
    nextSno.toString(),
    parsed.sId,
    parsed.offerId,
    parsed.offerName,
    from,         // The sender’s phone number
    userName,
    "0",          // Confirm = 0 initially
    ""            // Code empty initially
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [newRow] },
    });
    console.log("Appended new row to user sheet:", newRow);
  } catch (error) {
    console.error("Error appending new row:", error);
    return;
  }

  // 6. Get vendor details from Sheet2 (vendor sheet)
  let vendorData = [];
  try {
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet2!A:E', // Assuming columns: SNo, OfferID(Vendor), OfferName, Min, Contact
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet:", error);
    return;
  }

  // 7. Find the vendor row for this offer by matching OfferName (or OfferID if preferred)
  const vendorRow = vendorData.find(row => row[2].toLowerCase() === parsed.offerName.toLowerCase());
  if (!vendorRow) {
    console.error("No vendor data found for offer:", parsed.offerName);
    return;
  }
  const minThreshold = parseInt(vendorRow[3], 10);
  const vendorContact = vendorRow[4];
  console.log(`Found vendor row for offer. Min threshold: ${minThreshold}, Vendor contact: ${vendorContact}`);

  // 8. Count how many rows in the user sheet match this S_ID and have the same OfferName
  const matchingRows = userData.filter(row => row[1] === parsed.sId && row[3].toLowerCase() === parsed.offerName.toLowerCase());
  console.log(`Found ${matchingRows.length} matching rows for S_ID ${parsed.sId} and offer "${parsed.offerName}"`);

  // 9. If the count reaches the min threshold, update unconfirmed rows
  if (matchingRows.length >= minThreshold) {
    // For each matching row with Confirm = 0, generate a code, update the row, and send messages.
    for (let i = 0; i < userData.length; i++) {
      const row = userData[i];
      if (row[1] === parsed.sId && row[3].toLowerCase() === parsed.offerName.toLowerCase() && row[6] === "0") {
        // Generate code (using offerId, sId, and the phone number from the row)
        const code = generateCode(parsed.offerId, parsed.sId, row[4]);
        console.log(`Generated code for row: ${code}`);
        // Update the row in the sheet.
        // Here we assume the row index in the sheet is (i + 2) (because header is row 1).
        const rowIndex = i + 2;
        const updateRange = `Sheet1!G${rowIndex}:H${rowIndex}`;
        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId: USER_SHEET_ID,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [["1", code]] }, // Set Confirm to 1 and Code to generated code
          });
          console.log(`Updated row ${rowIndex} with confirmation and code ${code}`);
          
          // Send WhatsApp message to the user with the code.
          const userMessage = `Your offer "${parsed.offerName}" is confirmed. Use code ${code} to proceed.`;
          await sendWhatsAppMessage(row[4], userMessage);
          console.log(`Sent WhatsApp message to user ${row[4]}`);
        } catch (error) {
          console.error(`Error updating row ${rowIndex}:`, error);
        }
      }
    }
    // Additionally, notify the vendor that new user(s) are confirmed.
    const vendorMessage = `New user for offer "${parsed.offerName}" (phone: ${from}) has confirmed with code (check user sheet).`;
    await sendWhatsAppMessage(vendorContact, vendorMessage);
    console.log(`Sent WhatsApp message to vendor ${vendorContact}`);
  } else {
    console.log("Min threshold not yet reached; no confirmation code generated.");
  }
}

module.exports = {
  handleSrijanOffer,
};
