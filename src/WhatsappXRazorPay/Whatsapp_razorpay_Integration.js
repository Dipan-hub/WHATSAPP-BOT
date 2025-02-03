// src/whatsapprazorpay/WhatsAppRazorpayPayment.js
require("dotenv").config();
const axios = require("axios");

// Simple in-memory counter to generate unique references
let orderCounter = 0;

/**
 * Sends an interactive "order_details" message via WhatsApp Cloud API
 * with a Razorpay payment gateway option.
 *
 * @param {string} to - The recipient's WhatsApp phone number in E.164 format (e.g. '918123456789').
 * @returns {Promise<object>} - The response data from the WhatsApp API.
 */
async function sendRazorpayInteractiveMessage(to) {
  // Increment for each call -> new order/ref ID
  orderCounter++;
  const uniqueReferenceId = `order_ref_${orderCounter}`;
  const uniqueReceiptId   = `receipt_${orderCounter}`;

  // 1) Expiration (5 min from now)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // 2) Build the interactive "order_details" payload
  const interactivePayload = {
    type: "order_details",
    body: {
      text:
        "Here are your order details. Please review and tap 'Review and Pay' to complete the payment."
    },
    footer: {
      text: "Order expires in 5 minutes."
    },
    action: {
      name: "review_and_pay",
      parameters: {
        reference_id: uniqueReferenceId, // Unique per call
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name:
                process.env.RAZORPAY_CONFIG_NAME || "PP_Payment_Test",
              razorpay: {
                receipt: uniqueReceiptId,
                notes: {
                  promo: "testpromo"
                }
              }
            }
          }
        ],
        currency: "INR",
        total_amount: {
          value: 210, // 2.10 if offset=100
          offset: 100
        },
        order: {
          status: "pending",
          expiration: {
            timestamp: expirationTimestamp.toString(),
            description: "Order expires in 5 minutes"
          },
          items: [
            {
              name: "Product One",
              image: {
                link: "https://example.com/product1.jpg"
              },
              amount: {
                value: 100, // 1.00 if offset=100
                offset: 100
              },
              quantity: 1
            },
            {
              name: "Product Two",
              image: {
                link: "https://example.com/product2.jpg"
              },
              amount: {
                value: 100, // 1.00 if offset=100
                offset: 100
              },
              quantity: 1
            }
          ],
          subtotal: {
            value: 200, // 2.00
            offset: 100
          },
          tax: {
            value: 10,  // 0.10
            offset: 100,
            description: "5% tax"
          }
          // shipping, discount, etc. can be added
        }
      }
    }
  };

  // 3) Overall WhatsApp message
  const messagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactivePayload
  };

  // 4) Retrieve config
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappAccessToken   = process.env.WHATSAPP_TOKEN;

  if (!whatsappAccessToken) {
    throw new Error("Missing WHATSAPP_TOKEN in env.");
  }
  if (!whatsappPhoneNumberId) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID in env.");
  }

  // 5) Construct API URL
  const apiUrl = `https://graph.facebook.com/v16.0/${whatsappPhoneNumberId}/messages`;

  // 6) POST to WhatsApp
  try {
    const response = await axios.post(apiUrl, messagePayload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${whatsappAccessToken}`
      }
    });
    console.log("Razorpay interactive message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending Razorpay interactive message:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendRazorpayInteractiveMessage };
