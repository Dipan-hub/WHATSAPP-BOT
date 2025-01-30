// src/index.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleProductOffer, handlePaymentConfirmation } = require('./handleProductOffer');

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello from your WhatsApp Bot server!');
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

            if (message.interactive && message.interactive.type === "list_reply") {
                // Handling payment confirmation
                handlePaymentConfirmation(from, message.interactive.list_reply.id);
            } else if (msgBody && msgBody.includes("P_ID")) {
                handleProductOffer(from, msgBody);
            } else {
                console.warn(`Received a message from ${from} without a recognizable product identifier.`);
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
