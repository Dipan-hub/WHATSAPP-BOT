// src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

// Import your existing handleX.js functions
const { handleProductOffer, handlePaymentConfirmation } = require('./DominoSOffer/handleProductOffer');
const { handleLiveOffer } = require('./CabOffer/handleLiveOffer.js');
const { handlePicapoolOffer } = require('./GroupOffer/handlePicapoolOffer');

// Import the Razorpay interactive message function
//const { sendRazorpayInteractiveMessage } = require('./WhatsappXRazorPay/Whatsapp_razorpay_Integration.js');

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
      if (!body.object) return res.sendStatus(404);
  
      const webhookEvent = body.entry?.[0]?.changes?.[0]?.value;
      if (!webhookEvent) return res.sendStatus(404);
  
      /*
      // Check for "payment" statuses first (optional)
      if (webhookEvent.statuses) {
        // handle payment updates from WhatsApp
        webhookEvent.statuses.forEach((status) => {
          if (status.type === 'payment') {
            console.log("Payment Status Update:", JSON.stringify(status, null, 2));
            // You can handle capturing or logging transaction details here
            const confirmationMessage = `Payment for your order with ID: has been successfully processed.`;

            // Send confirmation message to the user
            //sendMessage(from, confirmationMessage);
        
            // Send confirmation message to the admin
            sendMessage(ADMIN_NUMBER, `Payment for order with ID:  has been processed. User:`);// ${from}`);
        
          }
        });
      }
      */
  
      // Check if there's a message
      const messages = webhookEvent.messages;
      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from;
        const msgBody = message.text?.body;
  
        if (from === ADMIN_NUMBER) {
          // Admin logic
          // Parse admin response for direct replies
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
            // If user selected an option from a list
            const { title, id } = message.interactive.list_reply;
            // e.g. handlePaymentConfirmation
            forwardMessageToAdmin(from,message.interactive.list_reply.title);
            await handlePaymentConfirmation(from, id);
  
          } else if (msgBody && msgBody.includes("P_ID")) {
            // user typed something with product IDs
            await handleProductOffer(from, msgBody);
  
          } else if (msgBody && msgBody.includes("L_ID")) {
            // some other handler
            await handleLiveOffer(from, msgBody);
  
          } else if (msgBody && msgBody.includes("Z_ID")) {
            // another handler
            await handlePicapoolOffer(from, msgBody);
  
          } else {
            // fallback
          }
        }
      }

      
      // Check for "payment" statuses first (optional)
      if (webhookEvent.statuses) {
        webhookEvent.statuses.forEach((status) => {
          if (status.type === 'payment') {
            console.log("Payment Status Update:", JSON.stringify(status, null, 2));
            
            // Extract details from the payment status JSON
            const recipient = status.recipient_id; // Recipient's phone number
            const referenceId = status.payment.reference_id;
            const orderId = status.payment.transaction.id;
            const amountValue = status.payment.amount.value;
            const offset = status.payment.amount.offset || 1;
            const actualAmount = amountValue / offset;
            
            // Create a beautiful confirmation message
            const confirmationMessage = `✅ your order has been successfully received🎉. 
Here are the details of your order:

- Order ID: ${orderId}
- Amount: INR ${actualAmount}
- Reference ID: ${referenceId} 

🚚 Your order will be delivered soon.

Thank you for choosing Picapool! 🙏💚`;

            
            // Send confirmation message to the recipient
            sendMessage(recipient, confirmationMessage);
            
            // Send a confirmation message to the admin
            sendMessage(ADMIN_NUMBER, `Payment confirmed for order ${orderId} (Ref: ${referenceId}). Amount: INR ${actualAmount}.`);
          }
        });
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

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
