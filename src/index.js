require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const ADMIN_NUMBER = '918917602924';
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

// In-memory storage for message contexts
let messageContexts = {};

app.get('/', (req, res) => {
    res.send('Hello from your modified WhatsApp Bot server!');
});

app.post("/webhook", async (req, res) => {
    const body = req.body;
    if (body.object) {
        const webhookEvent = body.entry?.[0]?.changes?.[0]?.value;
        if (!webhookEvent) {
            console.warn("Webhook event structure is invalid.");
            return res.sendStatus(404);
        }

        const messages = webhookEvent.messages;
        if (messages && messages.length > 0) {
            const message = messages[0];
            const from = message.from;
            const msgBody = message.text?.body;

            if (from === ADMIN_NUMBER) {
                // Handle reply from admin
                const contextId = message.context?.id;  // Assuming context ID is stored in the message metadata
                if (contextId && messageContexts[contextId]) {
                    sendMessage(messageContexts[contextId], msgBody);
                    delete messageContexts[contextId];  // Clean up after sending the reply
                }
            } else if (msgBody) {
                // Save context for potential reply
                messageContexts[message.id] = from;
                forwardMessageToAdmin(from, msgBody, message.id);
            }
        } else {
            console.warn("No messages found in the webhook event.");
        }

        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

function forwardMessageToAdmin(from, msgBody, messageId) {
    const url = `https://graph.facebook.com/v13.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: ADMIN_NUMBER,
        text: {
            body: `Message from ${from}: ${msgBody}`
        }
    };
    axios.post(url, data, {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    }).then(response => {
        console.log('Message forwarded to admin:', response.data);
    }).catch(error => {
        console.error('Error sending message:', error);
    });
}

function sendMessage(to, msgBody) {
    const url = `https://graph.facebook.com/v13.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: to,
        text: {
            body: msgBody
        }
    };
    axios.post(url, data, {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    }).then(response => {
        console.log('Reply sent:', response.data);
    }).catch(error => {
        console.error('Error replying to user:', error);
    });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
