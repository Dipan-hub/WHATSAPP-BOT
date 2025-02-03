// Whatsapp_razorpay_Integration.js
const axios = require('axios');

/**
 * Sends an interactive WhatsApp message with order details and Razorpay payment settings.
 * This interactive message includes two default products.
 *
 * @param {string} to - The recipient's phone number in international format.
 * @returns {Promise<Object>} - The response data from the WhatsApp API.
 */
async function sendRazorpayInteractiveMessage(to) {
  // Calculate an expiration timestamp (current time + 300 seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // Build the interactive object according to WhatsApp's order_details message specification.
  // This example uses Razorpay integration with "receipt" and "notes" fields.
  const interactivePayload = {
    type: "order_details",
    header: {
      type: "image",
      image: {
        // Replace with your own image URL if available
        link: "https://via.placeholder.com/150",
        provider: {
          name: "sample-provider"
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
        reference_id: "order_ref_123", // You can generate a dynamic reference id here
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name: "razorpay_config_1",
              razorpay: {
                // Provide a receipt number (max 40 characters) for internal reference
                receipt: "receipt-12345",
                // Notes as key/value pairs (max 15 keys, each value up to 256 characters)
                notes: {
                  promo: "testpromo"
                }
              }
            }
          }
        ],
        currency: "INR",
        total_amount: {
          // Total order amount in smallest currency unit (here 15000 represents ₹150.00)
          value: 15000,
          offset: 100
        },
        order: {
          status: "pending",
          // Using a catalog_id simplifies the payload. If not provided, you must include additional fields.
          catalog_id: "default_catalog",
          expiration: {
            timestamp: expirationTimestamp.toString(),
            description: "Order expires in 5 minutes"
          },
          // Two default products are defined below.
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
            value: 15000, // Sum of item amounts
            offset: 100
          },
          // Example tax information (5% of ₹150.00 is ₹7.50 i.e. 750 in paise)
          tax: {
            value: 750,
            offset: 100,
            description: "5% tax"
          }
          // You can also include shipping and discount objects if required.
        }
      }
    }
  };

  // Wrap the interactive object in the standard WhatsApp message object
  const messagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactivePayload
  };

  // Prepare the WhatsApp Graph API endpoint using your phone number ID.
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiUrl = `https://graph.facebook.com/v16.0/${whatsappPhoneNumberId}/messages`;

  try {
    const response = await axios.post(apiUrl, messagePayload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsappAccessToken}`
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
