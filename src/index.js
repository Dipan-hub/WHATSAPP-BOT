require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const ADMIN_NUMBER = '918917602924';
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

// In-memory storage for message contexts (keyed by admin's reply message ID)
let messageContexts = {};

app.get('/', (req, res) => {
    res.send('Hello from your modified WhatsApp Bot server!');
});

app.post("/webhook", async (req, res) => {
    const body = req.body;
    if (body.object) {
        const webhookEvent = body.entry[0].changes[0].value;
        if (!webhookEvent) {
            console.warn("Webhook event structure is invalid.");
            return res.sendStatus(404);
        }

        const messages = webhookEvent.messages;
        if (messages && messages.length > 0) {
            const message = messages[0];
            const from = message.from;
            const msgBody = message.text?.body;

            // Check if it's a reply from the admin
            if (from === ADMIN_NUMBER && message.context?.id) {
                // Find the original user to send the reply to
                const originalUser = messageContexts[message.context.id];
                if (originalUser) {
                    sendMessage(originalUser, msgBody);
                    delete messageContexts[message.context.id]; // Cleanup context
                }
            } else if (msgBody) {
                // Forward user message to admin
                messageContexts[message.id] = from; // Store context to map replies
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
            body: `Message from ${from}: ${msgBody}`,
            preview_url: false
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
