require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const ADMIN_NUMBER = '918917602924';
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

const { handleProductOffer, handlePaymentConfirmation } = require('./handleProductOffer');
const { handleLiveOffer } = require('./handleLiveOffer');
const { handlePicapoolOffer } = require('./handlePicapoolOffer');

app.get('/', (req, res) => {
    res.send('Hello from your WhatsApp Bot server!');
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

            if (from === ADMIN_NUMBER) {
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
                forwardMessageToAdmin(from, msgBody);
                
                // Check for specific commands
                if (message.interactive && message.interactive.type === "list_reply") {
                    forwardMessageToAdmin(from,message.interactive.list_reply.title);
                    handlePaymentConfirmation(from, message.interactive.list_reply.id);
                } else if (msgBody && msgBody.includes("P_ID")) {
                    handleProductOffer(from, msgBody);
                } else if (msgBody && msgBody.includes("L_ID")) {
                    handleLiveOffer(from, msgBody);
                } else if (msgBody && msgBody.includes("Z_ID")) {
                    handlePicapoolOffer(from, msgBody);
                } else {
                    // Forward any other user message to admin
                    //forwardMessageToAdmin(from, msgBody);
                }
            }
        } else {
            console.warn("No messages found in the webhook event.");
        }

        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

function forwardMessageToAdmin(from, msgBody) {
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
        console.log('Message sent to user:', response.data);
    }).catch(error => {
        console.error('Error sending message to user:', error);
    });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
