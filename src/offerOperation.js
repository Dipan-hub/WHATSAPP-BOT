// src/offerOperation.js
const { getSheetsClient } = require('./googleSheetOperation');
const { sendWhatsAppMessage } = require('./whatsapp');

const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

/**
 * Parse the incoming message.
 * Expected sample:
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
 * Generate a confirmation code.
 * (Full code is stored; messages show only the last 6 characters.)
 */
function generateCode(offerId, sId, phone) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${offerId}${sId}${phone.slice(-4)}${randomPart}`;
}

/**
 * Inserts a new row at a specific position in the sheet.
 * 
 * @param {Object} sheets - Authenticated Google Sheets client.
 * @param {number} insertionIndex - Zero-indexed relative to data rows (e.g. if data starts at row2, insertionIndex=0 means row2).
 * @param {Array} newRow - Array of cell values for the new row.
 */
async function insertRowAt(sheets, insertionIndex, newRow) {
  // Assuming the user sheet is Sheet1 with sheetId 0.
  const sheetId = 0;
  // The absolute sheet row number = insertionIndex + 2 (since data starts at row2)
  const absoluteRow = insertionIndex + 2;
  
  // Insert a blank row at the desired position.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: USER_SHEET_ID,
    resource: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: absoluteRow - 1, // zero-indexed: row2 is index 1
              endIndex: absoluteRow
            },
            inheritFromBefore: true
          }
        }
      ]
    }
  });
  
  // Now update that newly inserted row with newRow data.
  const updateRange = `Sheet1!A${absoluteRow}:H${absoluteRow}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: USER_SHEET_ID,
    range: updateRange,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] }
  });
}

/**
 * Constructs an interactive waitlist message.
 * Shows the offer, chat id, list of usernames already in the group, and minimum required.
 */
function buildWaitlistMessage(parsed, groupRows, minThreshold) {
  const usernames = groupRows.map(row => row[5]).filter(name => name && name.trim());
  return `*Offer:* ${parsed.offerName} (Chat ID: ${parsed.sId})
*Participants Joined:*
${usernames.map(u => `- ${u}`).join('\n')}
*Minimum required:* ${minThreshold}
Invite more friends to join and secure your coupon code!`;
}

/**
 * Constructs an interactive confirmation message.
 * Displays the coupon code (only last 6 characters) in a friendly format.
 */
function buildConfirmationMessage(parsed, displayCode) {
  return `*Congratulations!* Your offer "${parsed.offerName}" is confirmed.
*Your Coupon Code:* ${displayCode}
Use this code to proceed with your purchase.`;
}

/**
 * Constructs a vendor notification message listing new confirmations.
 * Only includes those users who were updated from unconfirmed to confirmed.
 */
function buildVendorNotificationMessage(parsed, confirmations) {
  let msg = `*Offer Update:* ${parsed.offerName} (Chat ID: ${parsed.sId})\nThe following users have just been confirmed:\n`;
  confirmations.forEach(item => {
    msg += `- ${item.userName} (Phone: ${item.phone}) -> Code: ${item.displayCode}\n`;
  });
  return msg;
}

/**
 * Main function to handle an incoming offer message.
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

  // Step 2. Lookup vendor details.
  let vendorData = [];
  try {
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet2!A:E'
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet. Check tab name/range.", error);
    return;
  }
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
  console.log(`Vendor: MIN=${minThreshold}, Contact=${vendorContact}`);

  // Step 3. Read user sheet data (data rows only, from A2:H).
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

  // Step 4. Check if an entry for S_ID, OfferName, and phone already exists.
  const existingEntry = userData.find(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase() &&
    row[4] === from
  );
  if (existingEntry) {
    console.log(`Existing entry found for phone ${from} in group ${existingEntry[0]}.`);
    if (existingEntry[6] === "1" && existingEntry[7] && existingEntry[7].trim()) {
      const displayCode = existingEntry[7].slice(-6);
      const confirmMsg = buildConfirmationMessage(parsed, displayCode);
      try {
        await sendWhatsAppMessage(from, confirmMsg);
        console.log(`Re-sent confirmation to ${from} with code ${displayCode}.`);
      } catch (err) {
        console.error("Error re-sending confirmation:", err);
      }
    } else {
      const waitMsg = buildWaitlistMessage(parsed, userData.filter(row =>
        row[1] === parsed.sId && row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
      ), minThreshold);
      try {
        await sendWhatsAppMessage(from, waitMsg);
        console.log(`Sent waitlist message to ${from}.`);
      } catch (err) {
        console.error("Error sending waitlist message:", err);
      }
    }
    return;
  }

  // Step 4b. Determine group number (Sno).
  let groupSno;
  const groupRows = userData.filter(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (groupRows.length > 0) {
    // Use the group number from an existing row.
    groupSno = groupRows[0][0];
    console.log(`Using existing group number ${groupSno} for S_ID ${parsed.sId}.`);
  } else {
    // New group: new Sno = (max existing Sno + 1) or 1 if none.
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

  // Step 4c. Determine username (first non-empty line from message).
  const lines = msgBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const userName = lines[0] || "Unknown";

  // Build new row.
  const newRow = [groupSno, parsed.sId, parsed.offerId, parsed.offerName, from, userName, "0", ""];

  // Step 4d. Insert the new row in sorted order.
  // If group already exists, insert immediately after the last row of that group.
  let insertionIndex = userData.length; // default: append at end.
  if (groupRows.length > 0) {
    // Find the last occurrence index (in the current userData array) where Sno equals groupSno.
    let lastIndex = -1;
    for (let i = 0; i < userData.length; i++) {
      if (userData[i][0] === groupSno) {
        lastIndex = i;
      }
    }
    insertionIndex = lastIndex + 1; // insert after the last row of the group.
  }
  console.log(`Inserting new row at data index ${insertionIndex} (sheet row ${insertionIndex + 2}).`);
  try {
    await insertRowAt(sheets, insertionIndex, newRow);
    console.log("Inserted new row:", newRow);
  } catch (error) {
    console.error("Error inserting new row:", error);
    return;
  }

  // Step 5. Re-read updated user sheet (data rows only).
  let updatedUserData = [];
  try {
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A2:H'
    });
    updatedUserData = res2.data.values || [];
    console.log("Updated user sheet data:", updatedUserData);
  } catch (error) {
    console.error("Error reading updated user sheet data:", error);
    return;
  }
  
  // Refresh group rows.
  const newGroupRows = updatedUserData.filter(row =>
    row[1] === parsed.sId &&
    row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  const totalCount = newGroupRows.length;
  console.log(`Group count for S_ID ${parsed.sId} and offer "${parsed.offerName}": ${totalCount}`);

  // Step 6. Check threshold.
  // We'll collect new confirmations (those updated from 0 to 1) to notify the vendor.
  const newConfirmations = [];
  if (totalCount >= minThreshold) {
    console.log(`Threshold reached (MIN=${minThreshold}). Confirming unconfirmed entries...`);
    // Loop over the updated data; note: the index i corresponds to sheet row = i + 2.
    for (let i = 0; i < updatedUserData.length; i++) {
      const row = updatedUserData[i];
      if (
        row[1] === parsed.sId &&
        row[3] && row[3].toLowerCase() === parsed.offerName.toLowerCase()
      ) {
        const sheetRowNum = i + 2;
        if (row[6] === "0") {
          // For unconfirmed, update this row.
          const fullCode = generateCode(parsed.offerId, parsed.sId, row[4]);
          const updateRange = `Sheet1!G${sheetRowNum}:H${sheetRowNum}`;
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: USER_SHEET_ID,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [["1", fullCode]] }
            });
            console.log(`Updated row ${sheetRowNum}: Confirm=1, Code=${fullCode}`);
            const displayCode = fullCode.slice(-6);
            const confirmMsg = buildConfirmationMessage(parsed, displayCode);
            await sendWhatsAppMessage(row[4], confirmMsg);
            console.log(`Sent confirmation to ${row[4]} with code ${displayCode}.`);
            newConfirmations.push({ phone: row[4], userName: row[5], displayCode });
          } catch (error) {
            console.error(`Error updating row ${sheetRowNum}:`, error);
          }
        } else if (row[6] === "1" && row[7] && row[7].trim() ) {
          // Already confirmed: re-send confirmation.
          const displayCode = row[7].slice(-6);
          const confirmMsg = buildConfirmationMessage(parsed, displayCode);
          try {
            await sendWhatsAppMessage(row[4], confirmMsg);
            console.log(`Re-sent confirmation to ${row[4]} with code ${displayCode}.`);
          } catch (error) {
            console.error(`Error re-sending confirmation to ${row[4]}:`, error);
          }
        }
      }
    }
    // Step 7. Notify vendor only once with new confirmations.
    if (newConfirmations.length > 0) {
      const vendorMsg = buildVendorNotificationMessage(parsed, newConfirmations);
      try {
        await sendWhatsAppMessage(vendorContact, vendorMsg);
        console.log(`Sent vendor notification: ${vendorMsg}`);
      } catch (error) {
        console.error("Error sending vendor notification:", error);
      }
    }
  } else {
    // Threshold not reached: send an interactive waitlist message to the new entry.
    const waitMsg = buildWaitlistMessage(parsed, newGroupRows, minThreshold);
    try {
      await sendWhatsAppMessage(from, waitMsg);
      console.log(`Sent waitlist message to ${from}.`);
    } catch (error) {
      console.error(`Error sending waitlist message to ${from}:`, error);
    }
  }
}

module.exports = { handleSrijanOffer };
