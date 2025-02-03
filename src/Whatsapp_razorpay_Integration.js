// Whatsapp_razorpay_Integration.js

// Load environment variables (only needed if running locally)
require('dotenv').config();

const axios = require('axios');

/**
 * Sends an interactive "order_details" message via WhatsApp Cloud API with a
 * Razorpay payment gateway setting. You must have 'WhatsApp Business' Cloud
 * API access and a valid phone number ID + token for this to work.
 *
 * @param {string} to - The recipient's WhatsApp phone number in E.164 format (e.g. '918123456789').
 * @returns {Promise<object>} - The response data from the WhatsApp API call.
 */
async function sendRazorpayInteractiveMessage(to) {
  // 1) Calculate expiration timestamp (5 minutes from now; in seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // 2) Build the interactive payload, following WhatsApp’s order_details schema
  const interactivePayload = {
    type: "order_details",
    header: {
      type: "image",
      image: {
        link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/pool/scaled_1000091178.jpg",
        provider: {
          name: "PICAPOOL"
        }
      }
    },
    body: {
      text: "Here are your order details. Please review your order and tap 'Review and Pay' to complete the payment via Razorpay."
    },
    footer: {
      text: "Order expires in 5 minutes."
    },
    action: {
      name: "review_and_pay",
      parameters: {
        reference_id: "order_ref_123", // You can generate dynamic reference IDs
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name: process.env.RAZORPAY_CONFIG_NAME || "PP_Payment_Test",
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
          value: 210, // total_amount = 200 (subtotal) + 10 (tax)
          offset: 100 // offset=100 means the above "value" is effectively "2.10" in the final display
        },
        order: {
          status: "pending",
          expiration: {
            timestamp: expirationTimestamp.toString(), // Must be > current time + 300
            description: "Order expires in 5 minutes"
          },
          items: [
            {
              name: "Product One",
              image: {
                link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/products/image_cropper_1736791210854.jpg"
              },
              amount: {
                value: 100,
                offset: 100
              },
              quantity: 1
            },
            {
              name: "Product Two",
              image: {
                link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/products/image_cropper_1736791210854.jpg"
              },
              amount: {
                value: 100,
                offset: 100
              },
              quantity: 1
            }
          ],
          subtotal: {
            value: 200,
            offset: 100
          },
          tax: {
            value: 10,
            offset: 100,
            description: "5% tax"
          }
          // shipping, discount, etc. omitted
        }
      }
    }
  };

  // 3) Wrap the interactive payload into the overall WhatsApp message object
  const messagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactivePayload
  };

  // 4) Retrieve config from env
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappAccessToken = process.env.WHATSAPP_TOKEN;

  if (!whatsappAccessToken) {
    console.error("WhatsApp access token is not defined. Please set the WHATSAPP_TOKEN environment variable.");
    throw new Error("Missing WhatsApp access token.");
  }
  if (!whatsappPhoneNumberId) {
    console.error("WhatsApp phone number ID is not defined. Please set the WHATSAPP_PHONE_NUMBER_ID environment variable.");
    throw new Error("Missing WhatsApp phone number ID.");
  }

  // 5) Construct the API URL
  const apiUrl = `https://graph.facebook.com/v16.0/${whatsappPhoneNumberId}/messages`;

  // 6) Make the POST request
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
