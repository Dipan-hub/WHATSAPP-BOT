const express = require('express');
const axios = require('axios');
const { handleIncomingMessage } = require('./messageHandler'); // Assuming this is your separate message handler module

const app = express();
app.use(express.json());

// Webhook to handle all types of incoming messages
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object) {
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        // Handle the list reply case
        if (message?.interactive?.type === "list_reply") {
            const userPhone = message.from;
            const selectedOption = message.interactive.list_reply.id;

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
                await axios.post(WHATSAPP_API_URL, {
                    messaging_product: "whatsapp",
                    to: userPhone,
                    type: "text",
                    text: { body: replyText }
                }, {
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" }
                });
                console.log(`User ${userPhone} selected: ${selectedOption}`);
            } catch (error) {
                console.error("Error sending message:", error.response?.data || error.message);
            }
        } else {
            // Handle general incoming messages (text messages)
            const messages = webhookEvent.messages;
            if (messages && messages.length > 0) {
                const message = messages[0];
                const from = message.from;  // Sender's phone number
                const msgBody = message.text.body;

                console.log(`Received message from ${from}: ${msgBody}`);

                // Call external handler for processing general messages
                try {
                    await handleIncomingMessage(from, msgBody);
                } catch (error) {
                    console.error("Error processing incoming message:", error);
                }
            }
        }

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Return a '404 Not Found' if the request is not from WhatsApp
        res.sendStatus(404);
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
