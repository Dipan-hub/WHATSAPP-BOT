// src/index.js

// 1. Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();


const { sendWhatsAppMessage } = require('./whatsapp.js');



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
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Check if this is an event from WhatsApp
  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value) {
      const webhookEvent = body.entry[0].changes[0].value;

      // Get the phone number and message
      const messages = webhookEvent.messages;
      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from; // Sender's phone number
        const msgBody = message.text.body;

        console.log(`Received message from ${from}: ${msgBody}`);

        // Here, you can process the message and decide on a response
        //const responseText = `You said: "${msgBody}"`;

        // Send a response back to the user
        //await sendWhatsAppMessage(from, responseText);

        // Inside the /webhook POST handler

          const { handleIncomingMessage } = require('./messageHandler.js');

          // Inside the /webhook POST handler
          await handleIncomingMessage(from, msgBody);


      }
    }

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if not from WhatsApp
    res.sendStatus(404);
  }
});


// 5. Start the server
const port = process.env.PORT || 3000;  // Default to 3000 if PORT is not set
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
