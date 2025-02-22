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
 * Generates a unique code combining offerId, sId, last 4 digits of phone, and a random alphanumeric string.
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
 *  4. Reads the vendor sheet to get the MIN threshold.
 *  5. If the number of entries in the same group reaches the threshold,
 *     it updates any unconfirmed rows (Confirm=0) by generating a code, updating the sheet,
 *     and sending WhatsApp messages to the user(s) and vendor.
 *
 * @param {string} from - The sender’s phone number.
 * @param {string} msgBody - The incoming message body.
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

  // 2. Get Google Sheets client.
  const sheets = await getSheetsClient();

  // 3. Read the current data from the user sheet.
  let userData = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: USER_SHEET_ID,
      range: 'Sheet1!A2:H',  // Assuming headers in row 1.
    });
    userData = res.data.values || [];
    console.log("Current user sheet data:", userData);
  } catch (error) {
    console.error("Error reading user sheet:", error);
    return;
  }

  // 4. Determine group number (Sno) for this offer.
  // If an entry with the same S_ID and OfferName exists, use its Sno; otherwise, assign a new group.
  let groupSno;
  const existingGroup = userData.find(row => row[1] === parsed.sId && row[3].toLowerCase() === parsed.offerName.toLowerCase());
  if (existingGroup) {
    groupSno = existingGroup[0]; // Use the same group number.
    console.log(`Existing group found for S_ID ${parsed.sId}; using Sno ${groupSno}.`);
  } else {
    // Determine the maximum Sno from the current data and add 1.
    let maxSno = 0;
    for (const row of userData) {
      if (row && row[0]) {
        const sno = parseInt(row[0], 10);
        if (sno > maxSno) maxSno = sno;
      }
    }
    groupSno = (maxSno + 1).toString();
    console.log(`No existing group for S_ID ${parsed.sId}; assigning new Sno ${groupSno}.`);
  }

  // 5. Build the new row.
  // For simplicity, assume the first non-empty line (excluding S_ID and Offer lines) is the user name.
  const lines = msgBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const userName = lines[0] || "Unknown";
  const newRow = [
    groupSno,
    parsed.sId,
    parsed.offerId,
    parsed.offerName,
    from,         // Sender’s phone number.
    userName,
    "0",          // Confirm = 0 initially.
    ""            // Code empty initially.
  ];

  // 6. Append the new row to the user sheet.
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

  // 7. Read vendor sheet data.
  let vendorData = [];
  try {
    // Ensure that the tab in your vendor sheet is exactly named "Sheet1".
    const vendorRes = await sheets.spreadsheets.values.get({
      spreadsheetId: VENDOR_SHEET_ID,
      range: 'Sheet1!A:E', // Columns: SNo, OfferID(Vendor), OfferName, Min, Contact.
    });
    vendorData = vendorRes.data.values || [];
    console.log("Vendor sheet data:", vendorData);
  } catch (error) {
    console.error("Error reading vendor sheet. Please verify that the tab is named exactly 'Sheet1 of Vendor' and the range is correct.", error);
    return;
  }

  // 8. Find the vendor row matching the OfferName.
  const vendorRow = vendorData.find(row => row[2].toLowerCase() === parsed.offerName.toLowerCase());
  if (!vendorRow) {
    console.error("No vendor data found for offer:", parsed.offerName);
    return;
  }
  const minThreshold = parseInt(vendorRow[3], 10);
  const vendorContact = vendorRow[4];
  console.log(`Vendor details: Min threshold = ${minThreshold}, Vendor contact = ${vendorContact}`);

  // 9. Count the number of rows in the user sheet for this group (same S_ID and OfferName).
  const groupRows = userData.filter(row => row[1] === parsed.sId && row[3].toLowerCase() === parsed.offerName.toLowerCase());
  console.log(`Group count for S_ID ${parsed.sId} and offer "${parsed.offerName}": ${groupRows.length}`);

  // Also include the new row (which hasn't been read in userData yet) in the count.
  const totalCount = groupRows.length + 1;
  console.log(`Total count after appending new row: ${totalCount}`);

      // 10. If total count reaches or exceeds the min threshold, process the group.
      if (totalCount >= minThreshold) {
        console.log(`Threshold reached (min = ${minThreshold}). Processing group rows...`);
        
        // Re-read updated user sheet data to work with the latest state.
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
        
        // Iterate over updated rows to update and notify those in our group.
        for (let i = 0; i < updatedUserData.length; i++) {
          const row = updatedUserData[i];
          // Check if the row belongs to our group.
          if (row[1] === parsed.sId && row[3].toLowerCase() === parsed.offerName.toLowerCase()) {
            // Compute the actual sheet row number (accounting for header row).
            const rowNumber = i + 2;
            // If the row is unconfirmed, update it to confirmed and generate a code.
            if (row[6] === "0") {
              const code = generateCode(parsed.offerId, parsed.sId, row[4]);
              const updateRange = `Sheet1!G${rowNumber}:H${rowNumber}`;
              try {
                await sheets.spreadsheets.values.update({
                  spreadsheetId: USER_SHEET_ID,
                  range: updateRange,
                  valueInputOption: 'USER_ENTERED',
                  resource: { values: [["1", code]] },
                });
                console.log(`Updated row ${rowNumber} with confirmation and code ${code}`);
                // Send confirmation message.
                const userMessage = `Your offer "${parsed.offerName}" is confirmed. Use code ${code} to proceed.`;
                await sendWhatsAppMessage(row[4], userMessage);
                console.log(`Sent confirmation message to ${row[4]}`);
              } catch (error) {
                console.error(`Error updating row ${rowNumber}:`, error);
              }
            } 
            // If already confirmed, re-send the existing code.
            else if (row[6] === "1" && row[7] && row[7].trim().length > 0) {
              console.log(`Row ${rowNumber} already confirmed. Re-sending code ${row[7]} to ${row[4]}.`);
              const userMessage = `Your offer "${parsed.offerName}" is confirmed. Use code ${row[7]} to proceed.`;
              try {
                await sendWhatsAppMessage(row[4], userMessage);
              } catch (error) {
                console.error(`Error re-sending message to ${row[4]}:`, error);
              }
            }
          }
        }
        
        // Notify the vendor that confirmation threshold has been reached.
        const vendorMessage = `For offer "${parsed.offerName}", the confirmation threshold has been reached. Please check the user sheet for details.`;
        try {
          await sendWhatsAppMessage(vendorContact, vendorMessage);
          console.log(`Sent vendor notification to ${vendorContact}`);
        } catch (error) {
          console.error("Error sending vendor notification:", error);
        }
      } else {
        console.log("Min threshold not yet reached; no update performed.");
      }  
  
}

module.exports = {
  handleSrijanOffer,
};
