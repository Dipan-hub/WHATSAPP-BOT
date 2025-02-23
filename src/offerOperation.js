// src/offerOperation.js
const { getSheetsClient } = require('./googleSheetOperation');
const { sendWhatsAppMessage } = require('./whatsapp');

// These IDs are set as environment variables.
const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

/**
 * Parse the incoming message.
 * Expected message sample:
 *   This side sjc
 *   S_ID: 534 
 *   OfferName: Testing the Test
 *   OfferID: 54
 *
 * Returns an object: { sId, offerName, offerId }
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
    offerId: offerIdMatch[1].trim()
  };
}

/**
 * Generate a confirmation code using offerId, sId, last 4 digits of phone, and a random string.
 */
function generateCode(offerId, sId, phone) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${offerId}${sId}${phone.slice(-4)}${randomPart}`;
}

/**
 * Main function to handle an incoming offer message.
 * 
 * Flow:
 * 1. Parse the message.
 * 2. Look up vendor sheet using OfferName to get the MIN threshold and vendor contact.
 *    - If no vendor record is found, treat it as an error (false operation).
 * 3. Read the user sheet for rows matching the same S_ID and OfferName.
 * 4. Check if an entry for the sender’s phone number already exists:
 *    a. If yes:
 *       - If already confirmed (Confirm=1 and a code exists), re-send that code.
 *       - If unconfirmed (Confirm=0), send a waitlist message.
 *    b. If no:
 *       - Determine the group number (Sno) – if any row exists for the same S_ID/OfferName, reuse its Sno; else assign a new Sno.
 *       - Append a new row with Confirm=0.
 * 5. Re-read the group rows and count them.
 * 6. If the group count is below the vendor MIN, send a waitlist (or status) message to the new entry.
 * 7. If the count reaches/exceeds MIN, then for every row in the group:
 *       - For unconfirmed rows (Confirm=0), generate a code, update the row (set Confirm=1 and Code), and send confirmation message.
 *       - For already confirmed rows (Confirm=1), re-send the stored code.
 * 8. Optionally, notify the vendor.
 */
async function handleSrijanOffer(from, msgBody) {
  console.log("=== Handling offer message from:", from, "===");
  let parsed;
  try {
    parsed = parseMessage(msgBody);
    console.log("Parsed message:", parsed);
  } catch (error) {
    console.error("Failed to parse message:", error.message);
    return;
  }

  const sheets = await getSheetsClient();

  // Step 2. Look up vendor details based on OfferName.
  let vendorData = [];
  try {
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet2!A:E' // Ensure the vendor tab is exactly named "Sheet2"
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet. Check the tab name and range.", error);
    return;
  }
  // Find vendor record by matching offer name (case-insensitive)
  const vendorRow = vendorData.find(row =>
    row[2] && row[2].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (!vendorRow) {
    console.error("No vendor record found for offer:", parsed.offerName);
    await sendWhatsAppMessage(from, `Error: The offer "${parsed.offerName}" is not recognized.`);
    return;
  }
  const minThreshold = parseInt(vendorRow[3], 10);
  const vendorContact = vendorRow[4];
  console.log(`Vendor details: MIN=${minThreshold}, Contact=${vendorContact}`);

  // Step 3. Read user sheet data for group (matching S_ID and OfferName)
  let userData = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A2:H'
    });
    userData = res.data.values || [];
    console.log("Current user sheet data:", userData);
  } catch (error) {
    console.error("Error reading user sheet:", error);
    return;
  }

  // Step 4. Check for an existing entry for the same S_ID and phone number.
  const existingEntry = userData.find(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase() &&
    row[4] === from
  );
  if (existingEntry) {
    console.log(`Existing entry found for phone ${from} in group ${existingEntry[0]}.`);
    if (existingEntry[6] === "1" && existingEntry[7] && existingEntry[7].trim().length > 0) {
      // Already confirmed: re-send the stored code.
      const confirmMsg = `Your offer "${parsed.offerName}" is confirmed. Use code ${existingEntry[7]} to proceed.`;
      try {
        await sendWhatsAppMessage(from, confirmMsg);
        console.log(`Re-sent confirmation to ${from} with code ${existingEntry[7]}.`);
      } catch (err) {
        console.error("Error re-sending confirmation:", err);
      }
    } else {
      // Not yet confirmed: send waitlist message.
      const waitMsg = `You are waitlisted for offer "${parsed.offerName}". We are waiting for additional confirmations.`;
      try {
        await sendWhatsAppMessage(from, waitMsg);
        console.log(`Sent waitlist message to ${from}.`);
      } catch (err) {
        console.error("Error sending waitlist message:", err);
      }
    }
    return; // End processing since the phone number already exists.
  }

  // Step 4b. No existing entry: determine group number (Sno)
  let groupSno;
  const groupRow = userData.find(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (groupRow) {
    groupSno = groupRow[0]; // reuse the existing group number
    console.log(`Using existing group number ${groupSno} for S_ID ${parsed.sId}.`);
  } else {
    // Otherwise, assign new group number: max existing Sno + 1
    let maxSno = 0;
    userData.forEach(row => {
      if (row && row[0]) {
        const sno = parseInt(row[0], 10);
        if (sno > maxSno) maxSno = sno;
      }
    });
    groupSno = (maxSno + 1).toString();
    console.log(`Assigned new group number ${groupSno} for S_ID ${parsed.sId}.`);
  }

  // Use the first non-empty line as the username (from the message)
  const lines = msgBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const userName = lines[0] || "Unknown";

  // Build a new row for the new entry:
  // [Sno, S_ID, OfferID, OfferName, PhoneNumber, UserName, Confirm, Code]
  const newRow = [groupSno, parsed.sId, parsed.offerId, parsed.offerName, from, userName, "0", ""];
  
  // Append new row to the user sheet.
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [newRow] }
    });
    console.log("Appended new row:", newRow);
  } catch (error) {
    console.error("Error appending new row:", error);
    return;
  }

  // Step 5. Re-read the updated user sheet to get the group rows.
  let updatedUserData = [];
  try {
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A:H'
    });
    updatedUserData = res2.data.values || [];
    console.log("Updated user sheet data:", updatedUserData);
  } catch (error) {
    console.error("Error reading updated user sheet data:", error);
    return;
  }
  
  // Filter rows for the same group (matching S_ID and OfferName)
  const groupRows = updatedUserData.filter(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  const totalCount = groupRows.length;
  console.log(`Group count for S_ID ${parsed.sId} and offer "${parsed.offerName}": ${totalCount}`);
  
  // Step 6. Check against vendor MIN threshold.
  if (totalCount >= minThreshold) {
    console.log(`Threshold reached (MIN=${minThreshold}). Confirming group entries...`);
    // For each row in the group, if unconfirmed then update and send confirmation.
    for (let i = 0; i < updatedUserData.length; i++) {
      const row = updatedUserData[i];
      if (
        row[1] === parsed.sId &&
        row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
      ) {
        // Determine sheet row number (account for header row)
        const sheetRowNum = i + 2;
        if (row[6] === "0") {
          // Generate a code and update the row.
          const code = generateCode(parsed.offerId, parsed.sId, row[4]);
          const updateRange = `Sheet1!G${sheetRowNum}:H${sheetRowNum}`;
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: USER_SHEET_ID,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [["1", code]] }
            });
            console.log(`Updated row ${sheetRowNum}: set Confirm=1 and Code=${code}.`);
            const confirmMsg = `Your offer "${parsed.offerName}" is confirmed. Use code ${code} to proceed.`;
            await sendWhatsAppMessage(row[4], confirmMsg);
            console.log(`Sent confirmation message to ${row[4]}.`);
          } catch (error) {
            console.error(`Error updating row ${sheetRowNum}:`, error);
          }
        } else if (row[6] === "1" && row[7] && row[7].trim().length > 0) {
          // Already confirmed: re-send confirmation message.
          const confirmMsg = `Your offer "${parsed.offerName}" is confirmed. Use code ${row[7]} to proceed.`;
          try {
            await sendWhatsAppMessage(row[4], confirmMsg);
            console.log(`Re-sent confirmation to ${row[4]} with code ${row[7]}.`);
          } catch (error) {
            console.error(`Error re-sending confirmation to ${row[4]}:`, error);
          }
        }
      }
    }
    // Notify the vendor that confirmation threshold has been met.
    const vendorMsg = `Offer "${parsed.offerName}" (S_ID: ${parsed.sId}) has reached the minimum threshold.`;
    try {
      await sendWhatsAppMessage(vendorContact, vendorMsg);
      console.log(`Sent vendor notification to ${vendorContact}.`);
    } catch (error) {
      console.error("Error sending vendor notification:", error);
    }
  } else {
    // Group count is still below MIN: send a waitlist message only to the new entry.
    const waitMsg = `You are waitlisted for offer "${parsed.offerName}". We need ${minThreshold} users; currently, ${totalCount} have joined. Please invite your friends!`;
    try {
      await sendWhatsAppMessage(from, waitMsg);
      console.log(`Sent waitlist message to ${from}.`);
    } catch (error) {
      console.error(`Error sending waitlist message to ${from}:`, error);
    }
  }
}

module.exports = { handleSrijanOffer };
