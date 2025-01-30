// src/index.js

// 1. Import necessary modules
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require("axios");
//const { sendWhatsAppMessage, sendListMessage } = require('./whatsapp.js');
const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');  // Ensure this line is correct

const { generatePaymentLink } = require('./payment.js');

const { extractOrderDetails, calculateFinalPrice } = require('./orderProcessor.js');

const WHATSAPP_API_URL = `https://graph.facebook.com/v15.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

// 2. Create an Express application
const app = express();

// 3. Use body-parser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// 4. Define a simple GET route to test
app.get('/', (req, res) => {
  res.send('Hello from your WhatsApp Bot server!');
});

// 4. Webhook Event Handler (POST)
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


              // Handle list responses for location selection
              if (message.interactive && message.interactive.type === "list_reply") {
                const selectedOption = message.interactive.list_reply.id;
                const priceDetails = yourFunctionToRetrieveStoredPriceDetails(from); // Implement this function based on your application's needs
                const finalPrice = priceDetails.finalPrice;

                // Generate payment link based on the selected location and final price
                //const paymentLink = `https://paymentgateway.com/pay?amount=${finalPrice}&location=${selectedOption}`;

                // Send the payment link to the user
                //await sendWhatsAppMessage(from, `Please complete your payment by visiting this link: ${paymentLink}`);


                    // Generate payment link
                  try {
                    const paymentLink = await generatePaymentLink(finalPrice);
                    await sendWhatsAppMessage(from, `Please complete your payment by visiting this link: ${paymentLink}`);
                } catch (error) {
                    console.error("Failed to generate payment link:", error);
                    await sendWhatsAppMessage(from, "Failed to generate payment link.");
                }
            } else {

            const msgBody = message.text?.body;

            if (msgBody) {
                console.log(`Received message from ${from}: ${msgBody}`);
                const { orderItems, totalDominosPrice } = extractOrderDetails(msgBody);

                if (orderItems.length > 0) {
                    const { picapoolTotal, tax, finalPrice } = calculateFinalPrice(orderItems);

                    const responseText = `Total price before tax: ₹${totalDominosPrice}\nDiscounted total: ₹${picapoolTotal}\nTax: ₹${tax}\nFinal price (after discounts and including tax): ₹${finalPrice}`;
                    await sendWhatsAppMessage(from, responseText);

                    // After sending the final price, prompt the user to select a location
                    await sendListMessage(from);
                } else {
                    await sendWhatsAppMessage(from, "No valid order items found in your message.");
                }
            } else {
                console.warn(`Received a message from ${from} without text content.`);
            }
        } 
        
      }
      
      else {
            console.warn("No messages found in the webhook event.");
        }

        // Respond with 200 OK to acknowledge receipt of the event
        res.sendStatus(200);
    } else {
        // Respond with 404 Not Found if the event is not from WhatsApp
        res.sendStatus(404);
    }
});

// 6. Start the server
const port = process.env.PORT || 3000;  // Default to 3000 if PORT is not set
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
