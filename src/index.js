// src/index.js

// 1. Import necessary modules
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require("axios");
const WHATSAPP_API_URL = `https://graph.facebook.com/v15.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');
const { handleIncomingMessage } = require('./messageHandler.js');

// 2. Create an Express application
const app = express();

// 3. Use body-parser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// Alternatively, you could do:
// app.use(express.json());

// 4. Define a simple GET route to test
app.get('/', (req, res) => {
  res.send('Hello Picapool from your WhatsApp Bot server!');
});

// Test route: GET /send-test-message
app.get('/send-test-message', async (req, res) => {
  try {
    // Replace with your personal WhatsApp phone number in international format, 
    // e.g. "911234567890" for India with country code 91
    const recipientNumber = '917033153236'

    // We'll send a test greeting
    const messageContent = 'Hello Dipan from my WhatsApp Cloud API Bot!';

    // Call our function
    await sendWhatsAppMessage(recipientNumber, messageContent);

    // Send a response to the browser
    res.status(200).send(`Test message sent to ${recipientNumber}!`);
  } catch (error) {
    console.error('Error in /send-test-message route:', error.message);
    res.status(500).send('Failed to send test message.');
  }
});

// 3. Webhook Verification Route
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.VERIFY_TOKEN;

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge); // Ensure challenge is sent as-is
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// 4. Webhook Event Handler (POST)
// Combined webhook handling form and normal chats
app.post("/webhook", async (req, res) => {
    const body = req.body;

    // Verify that the webhook event is from WhatsApp
    if (body.object) {
        const webhookEvent = body.entry?.[0]?.changes?.[0]?.value;

        if (!webhookEvent) {
            console.warn("Webhook event structure is invalid.");
            return res.sendStatus(404);
        }

        const messages = webhookEvent.messages;

        if (messages && messages.length > 0) {
            const message = messages[0];
            const from = message.from; // Sender's phone number

            // Check if the message is an interactive list reply
            if (message.interactive && message.interactive.type === "list_reply") {
                const selectedOption = message.interactive.list_reply.id;

                // Define responses for each list option
                const responses = {
                    option_1: "You selected Ramanujan Hostel.",
                    option_2: "You selected Raman Hostel.",
                    option_3: "You selected Aanadi Hostel.",
                    option_4: "You selected Sarabhai Hostel.",
                    option_5: "You selected Kalam Hostel.",
                    option_6: "You selected Bhabha Hostel.",
                    option_7: "You selected Visvesaraya Hostel.",
                    option_8: "You selected Sarojini Naidu Hostel."
                };

                const replyText = responses[selectedOption] || "Invalid selection.";

                try {
                    // Send the appropriate response back to the user
                    await axios.post(WHATSAPP_API_URL, {
                        messaging_product: "whatsapp",
                        to: from,
                        type: "text",
                        text: { body: replyText }
                    }, {
                        headers: { 
                            Authorization: `Bearer ${ACCESS_TOKEN}`, 
                            "Content-Type": "application/json" 
                        }
                    });
                    console.log(`User ${from} selected: ${selectedOption}`);
                } catch (error) {
                    console.error("Error sending interactive reply:", error.response?.data || error.message);
                }
            } 
            // If not an interactive list reply, handle as a regular message
            else {
                const msgBody = message.text?.body;

                if (msgBody) {
                    console.log(`Received message from ${from}: ${msgBody}`);

                    try {
                        // Process the incoming message using your handler
                        await handleIncomingMessage(from, msgBody);
                    } catch (error) {
                        console.error("Error handling incoming message:", error);
                    }
                } else {
                    console.warn(`Received a message from ${from} without text content.`);
                }
            }
        } else {
            console.warn("No messages found in the webhook event.");
        }

        // Respond with 200 OK to acknowledge receipt of the event
        res.sendStatus(200);
    } else {
        // Respond with 404 Not Found if the event is not from WhatsApp
        res.sendStatus(404);
    }
});

//for normal converstaion
// app.post('/webhook', async (req, res) => {
//   const body = req.body;

//   // Check if this is an event from WhatsApp
//   if (body.object) {
//     if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value) {
//       const webhookEvent = body.entry[0].changes[0].value;

//       // Get the phone number and message
//       const messages = webhookEvent.messages;
//       if (messages && messages.length > 0) {
//         const message = messages[0];
//         const from = message.from; // Sender's phone number
//         const msgBody = message.text.body;

//         console.log(`Received message from ${from}: ${msgBody}`);

//         // Here, you can process the message and decide on a response
//         //const responseText = `You said: "${msgBody}"`;

//         // Send a response back to the user
//         //await sendWhatsAppMessage(from, responseText);

//         // Inside the /webhook POST handler

//          // const { handleIncomingMessage } = require('./messageHandler.js');

//           // Inside the /webhook POST handler
//          // await handleIncomingMessage(from, msgBody);
//          const { handleIncomingMessage } = require('./messageHandler.js');

//           // Inside the /webhook POST handler
//           await handleIncomingMessage(from, msgBody);
//       }
//     }

//     // Return a '200 OK' response to all events
//     res.status(200).send('EVENT_RECEIVED');
//   } else {
//     // Return a '404 Not Found' if not from WhatsApp
//     res.sendStatus(404);
//   }
// });



// 5. Define a route to trigger the sending of a list message



// app.post('/send-list', async (req, res) => {
//   const { userPhone } = req.body;  // User's phone number passed in the body of the request
//   if (!userPhone) {
//     return res.status(400).json({ error: 'User phone number is required' });
//   }

//   try {
//     // Call the sendListMessage function from whatsappList.js
//     const response = await sendListMessage(userPhone);
//     res.json({ message: 'List message sent!', response });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });



// 6. Start the server
const port = process.env.PORT || 3000;  // Default to 3000 if PORT is not set
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
