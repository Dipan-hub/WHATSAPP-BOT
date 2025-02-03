// Whatsapp_razorpay_Integration.js

// Load environment variables (only needed for local testing)
require('dotenv').config();

const axios = require('axios');

async function sendRazorpayInteractiveMessage(to) {
  // Calculate expiration timestamp (5 minutes from now; in seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // Build the interactive payload following WhatsApp’s order_details schema.
  // We are not using a header image now, and instead we are including an image inside each product item.
  const interactivePayload = {
    type: "order_details",
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
        // The total_amount should be the sum of subtotal + tax (+ shipping - discount)
        total_amount: {
          value: 210, // For example, if subtotal=200 and tax=10, then total_amount = 210 (using offset 100)
          offset: 100
        },
        order: {
          status: "pending",
          // When not using catalog_id, you must provide these item-level details.
          expiration: {
            timestamp: expirationTimestamp.toString(),
            description: "Order expires in 5 minutes"
          },
          items: [
            {
              // Remove retailer_id when using a custom image for the item.
              name: "Product One",
              image: {
                // Include your product image URL here.
                link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/products/image_cropper_1736791210854.jpg"
              },
              amount: {
                value: 100, // This represents ₹1.00 if offset is 100; adjust accordingly
                offset: 100
              },
              quantity: 1,
              // The following fields are required when catalog_id is not provided.
              country_of_origin: "IN",
              importer_name: "Picapool",
              importer_address: "123, Some Street, City"
            },
            {
              name: "Product Two",
              image: {
                link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/products/image_cropper_1736791210854.jpg"
              },
              amount: {
                value: 100, // Adjust the value as needed
                offset: 100
              },
              quantity: 1,
              country_of_origin: "IN",
              importer_name: "Picapool",
              importer_address: "123, Some Street, City"
            }
          ],
          // Calculate the subtotal manually. Here we assume 100 paise each for 2 items = 200.
          subtotal: {
            value: 200,
            offset: 100
          },
          // Tax for the order; adjust the value as needed.
          tax: {
            value: 10, // For example, 5% tax on 200 would be 10 paise (₹0.10)
            offset: 100,
            description: "5% tax"
          }
          // Shipping and discount are not provided and default to 0.
        }
      }
    }
  };

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
  // Note: If your variable name is WHATSAPP_TOKEN, make sure to change it accordingly.
  const whatsappAccessToken = process.env.WHATSAPP_TOKEN;

  if (!whatsappAccessToken) {
    console.error("WhatsApp access token is not defined. Please set the WHATSAPP_TOKEN environment variable.");
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
