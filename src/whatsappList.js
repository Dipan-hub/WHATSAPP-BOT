require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

// Function to send WhatsApp List Message
async function sendListMessage(userPhone) {
    const payload = {
        messaging_product: "whatsapp",
        to: userPhone,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "Location"
            },
            body: { text: "Please select your hostel" },
            action: {
                button: "Choose Hostel",
                sections: [
                    {
                        title: "My Hostel",
                        rows: [
                            { id: "option_1", title: "Ramanujan" },
                            { id: "option_2", title: "Raman" },
                            { id: "option_3", title: "Aanadi" },
                            { id: "option_4", title: "Sarabhai" },
                            { id: "option_5", title: "Kalam" },
                            { id: "option_6", title: "Bhabha" },
                            { id: "option_7", title: "Visvesaraya" },
                            { id: "option_8", title: "Sarojini Naidu" }
                        ]
                    }
                ]
            }
        }
    };

    try {
        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

// Route to send list message
// app.post("/send-list", async (req, res) => {
//     const { userPhone } = req.body;
//     if (!userPhone) return res.status(400).json({ error: "User phone number is required" });
    
//     try {
//         const response = await sendListMessage(userPhone);
//         res.json({ message: "List message sent!", response });
//     } catch (error) {
//         res.status(500).json({ error });
//     }
// });

// Webhook to handle user responses
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object) {
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

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
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = {sendListMessage};