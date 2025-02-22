// src/offerOperation.js
const { getSheetsClient } = require('./googleSheetOperation');
const { sendWhatsAppMessage } = require('./whatsapp');

const USER_SHEET_ID = process.env.USER_SHEET_ID;
const VENDOR_SHEET_ID = process.env.VENDOR_SHEET_ID;

/**
 * Parses the incoming message to extract S_ID, OfferName, and OfferID.
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
 * Generates a unique confirmation code.
 */
function generateCode(offerId, sId, phone) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${offerId}${sId}${phone.slice(-4)}${randomPart}`;
}

/**
 * Main function to handle an incoming offer message.
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
      range: 'Sheet1!A2:H', // Headers in row 1.
    });
    userData = res.data.values || [];
    console.log("Current user sheet data:", userData);
  } catch (error) {
    console.error("Error reading user sheet:", error);
    return;
  }
  
  // 3. Check if an entry already exists for this S_ID and phone.
  const existingEntry = userData.find(row =>
    row[1] === parsed.sId &&
    row[4] === from &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  
  if (existingEntry) {
    console.log(`Entry already exists for S_ID ${parsed.sId} and phone ${from}.`);
    if (existingEntry[6] === "1" && existingEntry[7] && existingEntry[7].trim()) {
      // Already confirmed – re-send confirmation.
      const confirmMsg = `Your offer "${parsed.offerName}" is confirmed. Use code ${existingEntry[7]} to proceed.`;
      try {
        await sendWhatsAppMessage(from, confirmMsg);
        console.log(`Re-sent confirmation to ${from} with code ${existingEntry[7]}.`);
      } catch (err) {
        console.error("Error sending confirmation message:", err);
      }
    } else {
      // Not confirmed yet – send waitlist message.
      const waitMsg = `You are waitlisted for offer "${parsed.offerName}". We are waiting for additional confirmations.`;
      try {
        await sendWhatsAppMessage(from, waitMsg);
        console.log(`Sent waitlist message to ${from}.`);
      } catch (err) {
        console.error("Error sending waitlist message:", err);
      }
    }
    return; // End processing since the phone already exists.
  }
  
  // 4. New entry – determine group (Sno) for this S_ID/OfferName.
  let groupSno;
  const groupRow = userData.find(row =>
    row[1] === parsed.sId &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  if (groupRow) {
    groupSno = groupRow[0]; // Use existing group number.
    console.log(`Using existing group number ${groupSno} for S_ID ${parsed.sId}.`);
  } else {
    // Otherwise, assign a new group number (max existing Sno + 1).
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
  
  // Use the first non-empty line (excluding parsed lines) as the user name.
  const lines = msgBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const userName = lines[0] || "Unknown";
  
  // Build the new row: [Sno, S_ID, OfferID, OfferName, PhoneNumber, UserName, Confirm, Code]
  const newRow = [groupSno, parsed.sId, parsed.offerId, parsed.offerName, from, userName, "0", ""];
  
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
  
  // 5. Re-read updated user sheet data for the group.
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
  
  // Filter rows belonging to this group (same S_ID and OfferName).
  const groupRows = updatedUserData.filter(row =>
    row[1] === parsed.sId &&
    row[3].toLowerCase() === parsed.offerName.toLowerCase()
  );
  const totalCount = groupRows.length;
  console.log(`Group count for S_ID ${parsed.sId} and offer "${parsed.offerName}": ${totalCount}`);
  
  // 6. Read vendor sheet to determine MIN threshold.
  let vendorData = [];
  let vendorContact = "";
  try {
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet2!A:E', // Ensure the tab is named exactly "Sheet2"
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet. Check tab name and range.", error);
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
  
  // 7. If group count >= MIN, update all unconfirmed rows in this group.
  if (totalCount >= minThreshold) {
    console.log(`Threshold reached (min = ${minThreshold}). Confirming all unconfirmed entries in the group...`);
    for (let i = 0; i < updatedUserData.length; i++) {
      const row = updatedUserData[i];
      if (
        row[1] === parsed.sId &&
        row[3].toLowerCase() === parsed.offerName.toLowerCase()
      ) {
        // For each row in the group:
        if (row[6] === "0") {
          // Unconfirmed row – update it to confirmed.
          const code = generateCode(parsed.offerId, parsed.sId, row[4]);
          const rowNumber = i + 2; // Adjust for header row.
          const updateRange = `Sheet1!G${rowNumber}:H${rowNumber}`;
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: USER_SHEET_ID,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [["1", code]] },
            });
            console.log(`Updated row ${rowNumber} to confirmed with code ${code}.`);
            const confirmMsg = `Your offer "${parsed.offerName}" is confirmed. Use code ${code} to proceed.`;
            await sendWhatsAppMessage(row[4], confirmMsg);
            console.log(`Sent confirmation message to ${row[4]}.`);
          } catch (error) {
            console.error(`Error updating row ${rowNumber}:`, error);
          }
        } else if (row[6] === "1" && row[7] && row[7].trim()) {
          // Already confirmed – re-send the confirmation message.
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
    // Notify vendor once the group has been confirmed.
    const vendorMsg = `For offer "${parsed.offerName}", confirmation threshold reached. Check user sheet for details.`;
    try {
      await sendWhatsAppMessage(vendorContact, vendorMsg);
      console.log(`Sent notification to vendor ${vendorContact}.`);
    } catch (error) {
      console.error("Error sending vendor notification:", error);
    }
  } else {
    // If threshold is not reached, send a waitlist message only to the new entry.
    const waitMsg = `You are waitlisted for offer "${parsed.offerName}". We are waiting for additional confirmations.`;
    try {
      await sendWhatsAppMessage(from, waitMsg);
      console.log(`Sent waitlist message to ${from}.`);
    } catch (error) {
      console.error(`Error sending waitlist message to ${from}:`, error);
    }
  }
}

module.exports = { handleSrijanOffer };
