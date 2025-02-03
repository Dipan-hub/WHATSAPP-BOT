// Whatsapp_razorpay_Integration.js
const axios = require('axios');

async function sendRazorpayInteractiveMessage(to) {
  // Calculate expiration timestamp (5 minutes from now; in seconds)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300;

  // Build the interactive payload following WhatsApp’s order_details schema.
  // Note that the header image now uses a different URL (from Placekitten) to avoid media download issues.
  const interactivePayload = {
    type: "order_details",
    header: {
      type: "image",
      image: {
        // Use a publicly accessible image URL that returns a valid image.
        link: "https://www.lifewire.com/thmb/SFEc4jDldsGm33lTFFkhX6a7jhI=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/ScreenShot2020-04-20at10.03.23AM-d55387c4422940be9a4f353182bd778c.jpg"
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
        reference_id: "order_ref_123", // This can be dynamically generated as needed.
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name: "razorpay_config_1",
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
          value: 15000, // For example: 150.00 INR (value is in paise when offset is 100)
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
            value: 750, // 5% tax of 15000 paise (i.e., ₹7.50)
            offset: 100,
            description: "5% tax"
          }
        }
      }
    }
  };

  // Wrap the interactive payload in the overall WhatsApp message object.
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
