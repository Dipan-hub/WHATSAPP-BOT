// src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

// Import your existing handleX.js functions
const { handleProductOffer, handlePaymentConfirmation } = require('./handleProductOffer');
const { handleLiveOffer } = require('./handleLiveOffer');
const { handlePicapoolOffer } = require('./handlePicapoolOffer');

// Import the Razorpay interactive message function
const { sendRazorpayInteractiveMessage } = require('./whatsapprazorpay/WhatsAppRazorpayPayment');

const app = express();
app.use(bodyParser.json());

const ADMIN_NUMBER = '918917602924';  // your admin's WhatsApp
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

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
  }).catch(error => {
    console.error('Error forwarding message to admin:', error.response?.data || error.message);
  });
}

// This route is your main webhook endpoint for WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    if (!body.object) {
      return res.sendStatus(404);
    }

    // The standard structure: body.entry[0].changes[0].value
    const webhookEvent = body.entry?.[0]?.changes?.[0]?.value;
    if (!webhookEvent) {
      console.warn("Webhook event structure is invalid.");
      return res.sendStatus(404);
    }

    // 1) Check if there's a "statuses" array indicating a payment update
    if (webhookEvent.statuses) {
      const statuses = webhookEvent.statuses;
      for (let statusObj of statuses) {
        if (statusObj.type === "payment") {
          // We have a payment notification from WhatsApp
          console.log("PAYMENT WEBHOOK RECEIVED:", JSON.stringify(statusObj, null, 2));
          
          const { status: paymentStatus, payment } = statusObj;
          if (payment) {
            const { reference_id, transaction } = payment;

            console.log(`Payment for reference_id ${reference_id} is now ${paymentStatus}.`);
            if (transaction) {
              console.log("Transaction ID:", transaction.id);
              console.log("Transaction status:", transaction.status); // success/failed/pending
            }

            // Here you’d normally update your DB with the new payment status...
            // e.g. updateOrder(reference_id, paymentStatus);

            // If captured or success, you might send a confirmation message to user
            if (paymentStatus === "captured") {
              // statusObj.recipient_id is the user’s phone in some cases, or you can store from earlier
              const userWaId = statusObj.recipient_id; 
              // Send them a text or "order_status" message if needed
              sendMessage(userWaId, `Payment received for order: ${reference_id}!`);
            }
          }
        }
      }
    }

    // 2) Check for incoming messages
    const messages = webhookEvent.messages;
    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from; // WhatsApp phone of the sender
      const msgBody = message.text?.body;

      // If the admin is replying to a user
      if (from === ADMIN_NUMBER && msgBody) {
        const responseParts = msgBody.split(" - ");
        if (responseParts.length === 2) {
          const targetUser = responseParts[0].trim();
          const replyMessage = responseParts[1].trim();
          sendMessage(targetUser, replyMessage);
        } else {
          console.error("Admin message format is incorrect. Use 'phone_number - message_body'.");
        }
      } else {
        // Normal user message, forward to admin for monitoring
        forwardMessageToAdmin(from, msgBody);

        // Example commands
        if (message.interactive && message.interactive.type === "list_reply") {
          forwardMessageToAdmin(from, message.interactive.list_reply.title);
          handlePaymentConfirmation(from, message.interactive.list_reply.id);
        } 
        else if (msgBody && msgBody.includes("P_ID")) {
          handleProductOffer(from, msgBody);
        }
        else if (msgBody && msgBody.includes("L_ID")) {
          handleLiveOffer(from, msgBody);
        }
        else if (msgBody && msgBody.includes("Z_ID")) {
          handlePicapoolOffer(from, msgBody);
        }
        else if (msgBody && msgBody.toLowerCase().includes("pay now")) {
          // EXAMPLE: If user types "pay now", we trigger the Razorpay interactive message
          // You can change this logic to whatever you want
          await sendRazorpayInteractiveMessage(from);
        } 
        else {
          // handle other user messages
          // forwardMessageToAdmin(from, msgBody); // you already do so above
        }
      }
    }

    // Always respond 200 to let WhatsApp know we received the webhook
    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
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

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
