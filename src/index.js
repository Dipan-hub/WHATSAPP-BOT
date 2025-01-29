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
      res.status(200).send(challenge+'1');
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});


// 5. Start the server
const port = process.env.PORT || 3000;  // Default to 3000 if PORT is not set
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
