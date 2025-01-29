require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Route to send the interactive list message
app.post("/send-list", async (req, res) => {
    const { userPhone } = req.body; // Get user phone number from request

    const payload = {
        messaging_product: "whatsapp",
        to: userPhone,
        type: "interactive",
        interactive: {
            type: "list",
            header: { // header text
                type: "text",
                text: "Location"
            },
            body: { text: "Please select your hostel" },
            // footer: { text: "Select one option from below." },
            action: {
                button: "Choose Hostel",
                sections: [
                    {
                        title: " My Hostel",
                        rows: [
                            {
                                id: "option_1",
                                title: "Ramanujan"
                            },
                            {
                                id: "option_2",
                                title: "Raman"
                            },
                            {
                                id: "option_3",
                                title: "Aanadi"
                            },
                            {
                                id: "option_4",
                                title: "Sarabhai"
                            },
                            {
                                id: "option_5",
                                title: "Kalam"
                            },
                            {
                                id: "option_6",
                                title: "Bhabha"
                            },
                            {
                                id: "option_7",
                                title: "Visvesaraya"
                            },
                            {
                                id: "option_8",
                                title: "Sarojini Naidu"
                            }
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
        res.json({ message: "List message sent!", response: response.data });
    } catch (error) {
        res.status(500).json({ error: error.response.data });
    }
});

// Webhook to handle user responses
app.post("/webhook", (req, res) => {
    const body = req.body;

    if (body.object) {
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message?.interactive?.type === "list_reply") {
            const userPhone = message.from;
            const selectedOption = message.interactive.list_reply.id;

            const responses = {
                option_1: "You selected Order Issue. Please provide your Order ID.",
                option_2: "You selected Payment Issue. Please describe your issue.",
                option_3: "You selected General Inquiry. How can we help?"
            };

            const replyText = responses[selectedOption] || "Invalid selection.";

            axios.post(WHATSAPP_API_URL, {
                messaging_product: "whatsapp",
                to: userPhone,
                type: "text",
                text: { body: replyText }
            }, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" }
            });

            console.log(`User ${userPhone} selected: ${selectedOption}`);
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
