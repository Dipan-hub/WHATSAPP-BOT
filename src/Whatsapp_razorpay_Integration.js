// Whatsapp_razorpay_Integration.js

// Load environment variables (only needed if running locally)
require('dotenv').config();

const axios = require('axios');

async function sendRazorpayInteractiveMessage(to) {
  // Calculate expiration timestamp (5 minutes from now; in seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // Build the interactive payload following WhatsApp’s order_details schema.
  // Option 1: To include an image header, use a dummy image URL that returns JPEG.
  const interactivePayload = {
    type: "order_details",

    /*header: {
      type: "image",
      image: {
        // Use a placeholder image that returns JPEG
        link: "https://via.placeholder.com/150.jpg"
      }
    },*/

    body: {
      text: "Here are your order details. Please review your order and tap 'Review and Pay' to complete the payment via Razorpay."
    },
    footer: {
      text: "Order expires in 5 minutes."
    },
    action: {
      name: "review_and_pay",
      parameters: {
        reference_id: "order_ref_123", // You can generate a dynamic reference ID as needed.
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name: "PP_Payment_Test",
              razorpay: {
                receipt: "receipt-12345",
                notes: {
                  promo: "testpromo"
                }
              }
            }
          }
        ],
        currency: "INR",
        total_amount: {
          value: 15000, // For example, 150.00 INR (value is in paise when offset is 100)
          offset: 100
        },
        order: {
          status: "pending",
          catalog_id: "default_catalog",
          expiration: {
            timestamp: expirationTimestamp.toString(),
            description: "Order expires in 5 minutes"
          },
          items: [
            {
              retailer_id: "001",
              name: "Product One",
              amount: {
                value: 5000, // ₹50.00
                offset: 100
              },
              quantity: 1
            },
            {
              retailer_id: "002",
              name: "Product Two",
              amount: {
                value: 10000, // ₹100.00
                offset: 100
              },
              quantity: 1
            }
          ],
          subtotal: {
            value: 15000,
            offset: 100
          },
          tax: {
            value: 750, // 5% tax of 15000 paise (i.e. ₹7.50)
            offset: 100,
            description: "5% tax"
          }
        }
      }
    }
  };

  // If you prefer to skip the image header entirely, comment out the header section:
  /*
  const interactivePayload = {
    type: "order_details",
    body: {
      text: "Here are your order details. Please review your order and tap 'Review and Pay' to complete the payment via Razorpay."
    },
    footer: {
      text: "Order expires in 5 minutes."
    },
    action: {
      // ... rest of the payload remains the same
    }
  };
  */

  // Wrap the interactive payload into the overall WhatsApp message object.
  const messagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactivePayload
  };

  // Retrieve configuration from environment variables.
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappAccessToken = process.env.WHATSAPP_TOKEN;

  // Ensure the access token is set.
  if (!whatsappAccessToken) {
    console.error("WhatsApp access token is not defined. Please set the WHATSAPP_ACCESS_TOKEN environment variable.");
    throw new Error("Missing WhatsApp access token.");
  }

  const apiUrl = `https://graph.facebook.com/v16.0/${whatsappPhoneNumberId}/messages`;

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
    console.error(
      "Error sending Razorpay interactive message:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

module.exports = { sendRazorpayInteractiveMessage };
