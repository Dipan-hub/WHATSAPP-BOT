// src/offerOperation.js
const { getSheetsClient } = require('./googleSheetOperation');
const { sendWhatsAppMessage } = require('./whatsapp');

// IDs for the two sheets are set as environment variables.
const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

/**
 * Parse the incoming message to extract S_ID, OfferName, and OfferID.
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
 * Generate a unique confirmation code.
 */
function generateCode(offerId, sId, phone) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${offerId}${sId}${phone.slice(-4)}${randomPart}`;
}

/**
 * Main function to handle an incoming offer message.
 *
 * Steps:
 * 1. Parse the message.
 * 2. Read the user sheet and check if an entry exists for (S_ID, PhoneNumber).
 * 3. If exists:
 *    - If Confirm is "1": re-send the stored code.
 *    - If Confirm is "0": send a waitlist message.
 * 4. If not exists:
 *    - Determine group number (Sno): reuse if any row with same S_ID and OfferName exists; otherwise, assign new.
 *    - Append the new row.
 * 5. Re-read the group rows; if total count >= vendor's MIN threshold, update unconfirmed rows with a code and send confirmation.
 */
async function handleSrijanOffer(from, msgBody) {
  console.log("Handling offer message from:", from);
  
  // 1. Parse the incoming message.
  let parsed;
  try {
    parsed = parseMessage(msgBody);
    console.log("Parsed message:", parsed);
  } catch (error) {
    console.error("Failed to parse message:", error.message);
    return;
  }
  
  const sheets = await getSheetsClient();
  
  // 2. Read current user sheet data.
  let userData = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A2:H', // Assume headers in row 1.
    });
    userData = res.data.values || [];
    console.log("Current user sheet data:", userData);
  } catch (error) {
    console.error("Error reading user sheet:", error);
    return;
  }
  
  // 3. Check if an entry already exists for this S_ID and phone number.
  let existingRow = userData.find(row =>
    row[1] === parsed.sId &&
    row[4] === from &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  
  if (existingRow) {
    console.log(`Entry already exists for phone ${from} in group ${existingRow[0]}.`);
    if (existingRow[6] === "1" && existingRow[7] && existingRow[7].trim().length > 0) {
      // Already confirmed: re-send confirmation.
      const userMessage = `Your offer "${parsed.offerName}" is confirmed. Use code ${existingRow[7]} to proceed.`;
      try {
        await sendWhatsAppMessage(from, userMessage);
        console.log(`Re-sent confirmation to ${from} with code ${existingRow[7]}.`);
      } catch (error) {
        console.error(`Error sending confirmation to ${from}:`, error);
      }
    } else if (existingRow[6] === "0") {
      // Not confirmed yet: send waitlisted message.
      const waitlistMessage = `You are waitlisted for offer "${parsed.offerName}". We are waiting for additional confirmations.`;
      try {
        await sendWhatsAppMessage(from, waitlistMessage);
        console.log(`Sent waitlist message to ${from}.`);
      } catch (error) {
        console.error(`Error sending waitlist message to ${from}:`, error);
      }
    }
    return; // Exit since the phone number already exists.
  }
  
  // 4. No entry exists for this phone number.
  // Determine group number (Sno): If a row with the same S_ID and OfferName exists, use its Sno.
  let groupSno;
  const existingGroupRow = userData.find(row =>
    row[1] === parsed.sId &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (existingGroupRow) {
    groupSno = existingGroupRow[0];
    console.log(`Using existing group number ${groupSno} for S_ID ${parsed.sId}.`);
  } else {
    // Otherwise, assign a new Sno (max existing Sno + 1).
    let maxSno = 0;
    userData.forEach(row => {
      if (row && row[0]) {
        const sno = parseInt(row[0], 10);
        if (sno > maxSno) maxSno = sno;
      }
    });
    groupSno = (maxSno + 1).toString();
    console.log(`Assigning new group number ${groupSno} for S_ID ${parsed.sId}.`);
  }
  
  // Assume the first non-empty line (excluding S_ID, OfferName, etc.) is the user name.
  const lines = msgBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const userName = lines[0] || "Unknown";
  const newRow = [
    groupSno,
    parsed.sId,
    parsed.offerId,
    parsed.offerName,
    from,
    userName,
    "0",  // Confirm is 0 initially.
    ""    // Code is empty initially.
  ];
  
  // Append the new row.
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [newRow] },
    });
    console.log("Appended new row:", newRow);
  } catch (error) {
    console.error("Error appending new row:", error);
    return;
  }
  
  // 5. Re-read the sheet data for this group.
  let updatedUserData = [];
  try {
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A:H',
    });
    updatedUserData = res2.data.values || [];
    console.log("Updated user sheet data:", updatedUserData);
  } catch (error) {
    console.error("Error reading updated user sheet data:", error);
    return;
  }
  
  // Filter rows in the same group (S_ID and OfferName match).
  const groupRows = updatedUserData.filter(row =>
    row[1] === parsed.sId &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  const totalCount = groupRows.length;
  console.log(`Group count for S_ID ${parsed.sId} and offer "${parsed.offerName}": ${totalCount}`);
  
  // Read vendor data to get the MIN threshold.
  let vendorData = [];
  let vendorContact = "";
  try {
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet2!A:E', // Make sure the tab is named exactly "Sheet2"
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet. Verify the tab name and range.", error);
    return;
  }
  
  const vendorRow = vendorData.find(row =>
    row[2].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (!vendorRow) {
    console.error("No vendor data found for offer:", parsed.offerName);
    return;
  }
  const minThreshold = parseInt(vendorRow[3], 10);
  vendorContact = vendorRow[4];
  console.log(`Vendor details: MIN threshold = ${minThreshold}, Contact = ${vendorContact}`);
  
  // 6. If the total count has reached or exceeded the threshold, update unconfirmed rows.
  if (totalCount >= minThreshold) {
    console.log(`Threshold reached (min = ${minThreshold}). Updating group rows...`);
    for (let i = 0; i < updatedUserData.length; i++) {
      const row = updatedUserData[i];
      if (
        row[1] === parsed.sId &&
        row[3].toLowerCase() === parsed.offerName.toLowerCase() &&
        row[4] === from // only update the newly added row OR process only if the phone number is the one we just added
      ) {
        // For this new entry, if it's unconfirmed, update it.
        if (row[6] === "0") {
          const code = generateCode(parsed.offerId, parsed.sId, row[4]);
          const rowNumber = i + 2; // accounting for header row
          const updateRange = `Sheet1!G${rowNumber}:H${rowNumber}`;
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: USER_SHEET_ID,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [["1", code]] },
            });
            console.log(`Updated row ${rowNumber} with confirmation and code ${code}`);
            const confirmMessage = `Your offer "${parsed.offerName}" is confirmed. Use code ${code} to proceed.`;
            await sendWhatsAppMessage(row[4], confirmMessage);
            console.log(`Sent confirmation message to ${row[4]}`);
          } catch (error) {
            console.error(`Error updating row ${rowNumber}:`, error);
          }
        }
      }
    }
  } else {
    // If threshold is not reached, send a waitlist message to the new phone number.
    const waitlistMessage = `You are waitlisted for offer "${parsed.offerName}". We are waiting for additional confirmations.`;
    try {
      await sendWhatsAppMessage(from, waitlistMessage);
      console.log(`Sent waitlist message to ${from}.`);
    } catch (error) {
      console.error(`Error sending waitlist message to ${from}:`, error);
    }
  }
}

module.exports = {
  handleSrijanOffer,
};
