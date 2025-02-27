// src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

// Import your existing handleX.js functions
const { handleProductOffer, handlePaymentConfirmation , PaymentConfirmationMessage} = require('./DominoSOffer/handleProductOffer');
const { handleLiveOffer } = require('./CabOffer/handleLiveOffer.js');
const { handlePicapoolOffer } = require('./GroupOffer/handlePicapoolOffer');
const { handleSrijanOffer } = require('./offerOperation.js');
const { getSheetsClient ,  addRowToSheet } = require('./googleSheetOperation.js');
const SHEET_ID = '15qXHKDZ6Gc0jDJj4axxQVmXU45noST4f5aaTSX2iogw';


// Import the Razorpay interactive message function
// const { sendRazorpayInteractiveMessage } = require('./WhatsappXRazorPay/Whatsapp_razorpay_Integration.js');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

const ADMIN_NUMBER = '918917602924';  // your admin's WhatsApp
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,OFFER_ACTIVE } = process.env;

// Global variables for order limit tracking
let dailyOrderCount = 0;
const DAILY_ORDER_LIMIT = 20;

// index.js
console.log("Starting index.js...");

// Import our custom Google Sheet operation module

// Quick function to send a normal text message to a WhatsApp user
function sendMessage(to, msgBody) {
  const url = `https://graph.facebook.com/v16.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to: to,
    text: { body: msgBody }
  };

  return axios.post(url, data, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  })
    .then(response => {

      console.log('Message sent:', response.data);

      // ✅ Add row to Google Sheet after message is sent
    addRowToSheet([to, msgBody, Math.floor(Date.now() / 1000), 1], process.env.SHEET_ID)
    .then(() => console.log('✅ Logged to Google Sheets'))
    .catch(error => console.error('❌ Error logging to Google Sheets:', error));

      return response.data;
    })
    .catch(error => {
      console.error('Error sending message:', error.response?.data || error.message);
    });
}
    
// Forward the user’s message to the admin
function forwardMessageToAdmin(from, msgBody) {
  const url = `https://graph.facebook.com/v16.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to: ADMIN_NUMBER,
    text: {
      body: `Message from ${from}: ${msgBody}`,
      preview_url: false
    }
  };
  axios.post(url, data, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  }).then(response => {
    
    console.log('Message forwarded to admin:', response.data);

    // ✅ Add row to Google Sheet after message is sent
    addRowToSheet([from, msgBody, Math.floor(Date.now() / 1000), 0], process.env.SHEET_ID)
      .then(() => console.log('✅ Logged to Google Sheets'))
      .catch(error => console.error('❌ Error logging to Google Sheets:', error));

  }).catch(error => {
    console.error('Error forwarding message to admin:', error.response?.data || error.message);
  });
  
}

// This route is your main webhook endpoint for WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    if (!body.object) return res.sendStatus(404);

    const webhookEvent = body.entry?.[0]?.changes?.[0]?.value;
    if (!webhookEvent) return res.sendStatus(404);

    // Check for payment statuses (if any)
    if (webhookEvent.statuses) {
      webhookEvent.statuses.forEach(async (status) => {
      //webhookEvent.statuses.forEach((status) => {
        if (status.type === 'payment') {
          console.log("Payment Status Update:", JSON.stringify(status, null, 2));
          
          // Extract details from the payment status JSON
          const recipient = status.recipient_id; // Recipient's phone number
          const referenceId = status.payment.reference_id;
          const orderId = status.payment.transaction.id;
          const amountValue = status.payment.amount.value;
          const offset = status.payment.amount.offset || 1;
          const actualAmount = amountValue / offset;


          await PaymentConfirmationMessage(recipient,status);

          /*
          
          // Create a confirmation message for the user
          const confirmationMessage = `✅ Your order has been successfully received 🎉. 
Here are the details of your order:

- Order ID: ${orderId}
- Amount: INR ${actualAmount}
- Reference ID: ${referenceId} 

🚚 Your order will be delivered soon.

Thank you for choosing Picapool! 🙏💚`;

          // Send confirmation message to the recipient
          sendMessage(recipient, confirmationMessage);

          const adminMessage = `✅ Order confirmed:
- Order ID: ${orderId}
- Amount: INR ${actualAmount}
- Reference ID: ${referenceId}
- Recipient: ${recipient}
          
Your order has been received.`;
          
          // Send a confirmation message to the admin
          sendMessage(ADMIN_NUMBER, adminMessage);*/

        }
      });
    }
    
    // Check if there's a message
    const messages = webhookEvent.messages;
    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;
      const msgBody = message.text?.body;

      // Log the incoming message to Google Sheets
      /*
try {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:D', // Adjust if your sheet has a different structure
    valueInputOption: 'RAW',
    resource: {
      values: [[from, msgBody, message.timestamp || new Date().toISOString(),0]]
    },
  });
  console.log('Message logged to Google Sheets.');
} catch (err) {
  console.error('Error logging message to Google Sheets:', err);
}*/
// --- INSERTED CODE BLOCK START ---
// Trigger update on the Vercel endpoint to notify new data is available
axios.post('https://whatsapp-clone-fip95xwxs-deeeps-projects.vercel.app/api/trigger-update', { timestamp: Date.now() })
  .then(response => {
    console.log('Trigger update sent successfully:', response.data);
  })
  .catch(error => {
    console.error('Error sending trigger update:', error.response?.data || error.message);
  });
// --- INSERTED CODE BLOCK END ---


      // For non-admin senders, check if we've reached today's order limit
      
      if (OFFER_ACTIVE <1) {
        forwardMessageToAdmin(from, msgBody);
        //const orderLimitMsg = "We have reached today's order limit of 20 orders, please come back soon!";
        const orderLimitMsg = `
  📈 We have reached today's order limit of *20 orders*.
  ⏳ Please come back tomorrow and place your order then.
  Thank you for your understanding! 🙏
      `;
      
      
        await sendMessage(from, orderLimitMsg);
        return res.sendStatus(200);
      }
  
      if (from === ADMIN_NUMBER) {
        // Admin logic: parse admin response for direct replies
        const responseParts = msgBody.split(" - ");
        if (responseParts.length === 2) {
          const targetUser = responseParts[0].trim();
          const replyMessage = responseParts[1].trim();
          sendMessage(targetUser, replyMessage);
        } else {
          console.error("Admin message format is incorrect. Use 'phone_number - message_body'.");
        }
      } else {
        // Forward user message to admin
        forwardMessageToAdmin(from, msgBody);
  
        if (message.interactive && message.interactive.type === "list_reply") {
          // If user selected an option from a list (e.g., payment confirmation)
          const { title, id } = message.interactive.list_reply;
          forwardMessageToAdmin(from, title);
          await handlePaymentConfirmation(from, title);
          dailyOrderCount++;
        } else if (msgBody && msgBody.includes("P_ID")) {
          // User typed something with product IDs (assumed to be an order)
          await handleProductOffer(from, msgBody);
          dailyOrderCount++;
        } else if (msgBody && msgBody.includes("L_ID")) {
          // Some other handler for live offers
          await handleLiveOffer(from, msgBody);
          dailyOrderCount++;
        } else if (msgBody && msgBody.includes("Z_ID")) {
          // Another handler for Picapool offers
          await handlePicapoolOffer(from, msgBody);
          dailyOrderCount++;
        } else if (msgBody && msgBody.includes("S_ID")) {
          // Some other handler for live offers
          await handleSrijanOffer(from, msgBody);
          dailyOrderCount++;
        }else {
          // Fallback: you can add any default behavior here
        }
      }
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error("Error in webhook:", err);
    res.sendStatus(500);
  }
});

// Optional GET route if you do verification handshake
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED!");
    return res.status(200).send(challenge);
  } else {
    console.log("WEBHOOK VERIFICATION FAILED!");
    return res.sendStatus(403);
  }
});

// Just a test route
app.get('/', (req, res) => {
  res.send('Hello from your WhatsApp Bot server!');
});

// New endpoint to fetch messages from the Google Sheet
app.get('/messages', async (req, res) => {
  try {
    const sheets = await getSheetsClient(); // Using your existing googlesheetoperation.js module
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:C', // Assumes columns: Phone, Message, Time
    });
    let rows = result.data.values;
    if (rows && rows.length > 1) {
      // Assuming first row is header; remove it if needed
      rows = rows.slice(1);
    }
    // Map rows to objects
    const messages = rows ? rows.map(row => ({
      phone: row[0],
      message: row[1],
      time: row[2]
    })) : [];
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).send("Error fetching messages");
  }
});

app.post('/api/update-sheet', async (req, res) => {
  const { phone, message, timestamp, isOutbound } = req.body;

  try {
    // Ensure Google Sheets update logic works (from googleSheetOperation.js)
    const rowData = [phone, message, timestamp, isOutbound];
    const result = await addRowToSheet(rowData, SHEET_ID);
    console.log('Row appended to Google Sheet:', result);
    res.status(200).json({ success: true, message: 'Message logged to Google Sheets' });
  } catch (error) {
    console.error('Error updating Google Sheet:', error);
    res.status(500).json({ error: error.message });
  }
});


// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});