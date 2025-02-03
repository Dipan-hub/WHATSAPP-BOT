// Whatsapp_razorpay_Integration.js

// Load environment variables (only needed if running locally)
require('dotenv').config();

const axios = require('axios');

async function sendRazorpayInteractiveMessage(to) {
  // Calculate expiration timestamp (5 minutes from now; in seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // Build the interactive payload following WhatsApp’s order_details schema.
  // (Image header is commented out; you can include it if needed.)
  const interactivePayload = {
    type: "order_details",
    /* Uncomment to include a header image:
    header: {
      type: "image",
      image: {
        // Use a valid image URL that returns JPEG or PNG
        link: "https://via.placeholder.com/150.jpg"
      }
    },
    */
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
        total_amount: {
          value: 210, // total_amount = subtotal (200) + tax (10) [offset=100]
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
                link: "https://picapool-store.s3.ap-south-1.amazonaws.com/images/products/image_cropper_1736791210854.jpg"
              },
              amount: {
                value: 100,
                offset: 100
              },
              quantity: 1,
              //country_of_origin: "IN",
              //importer_name: "Picapool",
              // Instead of using { address: "..." } use a key the API expects.
              //importer_address:  "123, Some Street, City" 
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
              quantity: 1,
              //country_of_origin: "IN",
             // importer_name: "Picapool",
              //importer_address: "123, Some Street, City" 
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
          // Shipping and discount are omitted (assumed to be 0)
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
