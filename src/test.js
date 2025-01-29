// const express = require('express');
// const axios = require('axios');
// const { handleIncomingMessage } = require('./messageHandler'); // Assuming this is your separate message handler module

// const app = express();
// app.use(express.json());

// // Webhook to handle all types of incoming messages
// app.post("/webhook", async (req, res) => {
//     const body = req.body;

//     if (body.object) {
//         const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

//         // Handle the list reply case
//         if (message?.interactive?.type === "list_reply") {
//             const userPhone = message.from;
//             const selectedOption = message.interactive.list_reply.id;

//             const responses = {
//                 option_1: "You selected Ramanujan Hostel.",
//                 option_2: "You selected Raman Hostel.",
//                 option_3: "You selected Aanadi Hostel.",
//                 option_4: "You selected Sarabhai Hostel.",
//                 option_5: "You selected Kalam Hostel.",
//                 option_6: "You selected Bhabha Hostel.",
//                 option_7: "You selected Visvesaraya Hostel.",
//                 option_8: "You selected Sarojini Naidu Hostel."
//             };

//             const replyText = responses[selectedOption] || "Invalid selection.";

//             try {
//                 await axios.post(WHATSAPP_API_URL, {
//                     messaging_product: "whatsapp",
//                     to: userPhone,
//                     type: "text",
//                     text: { body: replyText }
//                 }, {
//                     headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" }
//                 });
//                 console.log(`User ${userPhone} selected: ${selectedOption}`);
//             } catch (error) {
//                 console.error("Error sending message:", error.response?.data || error.message);
//             }
//         } else {
//             // Handle general incoming messages (text messages)
//             const messages = webhookEvent.messages;
//             if (messages && messages.length > 0) {
//                 const message = messages[0];
//                 const from = message.from;  // Sender's phone number
//                 const msgBody = message.text.body;

//                 console.log(`Received message from ${from}: ${msgBody}`);

//                 // Call external handler for processing general messages
//                 try {
//                     await handleIncomingMessage(from, msgBody);
//                 } catch (error) {
//                     console.error("Error processing incoming message:", error);
//                 }
//             }
//         }

//         // Return a '200 OK' response to all events
//         res.status(200).send('EVENT_RECEIVED');
//     } else {
//         // Return a '404 Not Found' if the request is not from WhatsApp
//         res.sendStatus(404);
//     }
// });

// // Start the server
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });


const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Constants (ensure these are defined appropriately)
const WHATSAPP_API_URL = 'https://graph.facebook.com/v13.0/YOUR_PHONE_NUMBER_ID/messages';
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN';

// Import your message handler
const { handleIncomingMessage } = require('./messageHandler.js');

// Combined Webhook Route
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

// Start the server (ensure the port is set appropriately)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook server is running on port ${PORT}`);
});
