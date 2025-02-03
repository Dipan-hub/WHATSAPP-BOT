// src/WhatsappXRazorPay/Whatsapp_razorpay_Integration.js
require("dotenv").config();
const axios = require("axios");

// Instead of a simple static function, we accept dynamic data:
async function sendDynamicRazorpayInteractiveMessage({
  to,
  referenceId,
  items,
  subtotal,
  taxAmount,
  taxDescription,
  totalPayable
}) {
  /**
   * WhatsApp expects `value` in *integer* and `offset=100` if using two decimals.
   * For example, ₹210 => value=21000, offset=100 => displayed as "210.00".
   */
  const totalInPaise = Math.round(totalPayable * 100);
  const taxInPaise = Math.round(taxAmount * 100);
  const subInPaise = Math.round(subtotal * 100);

  // Build items array for the order_details
  // Each item expects { name, amount {value, offset}, quantity, image {link} } if you want images
  const whatsappItems = items.map((item) => {
    const itemPriceInPaise = Math.round(item.mrp * 100);
    return {
      name: `Product ${item.pID}`,
      //image: {
      //  link: item.image || "https://example.com/no-image.jpg"
      //},
      amount: {
        value: itemPriceInPaise,
        offset: 100
      },
      quantity: 1
    };
  });

  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 mins from now

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
        reference_id: referenceId, // Make sure it's unique per order
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name:
                process.env.RAZORPAY_CONFIG_NAME || "PP_Payment_Test",
              razorpay: {
                // You can pass a unique receipt or order_id if you want
                receipt: "receipt_" + referenceId,
                notes: {
                  promo: "testpromo"
                }
              }
            }
          }
        ],
        currency: "INR",
        total_amount: {
          value: totalInPaise,
          offset: 100
        },
        order: {
          status: "pending",
          expiration: {
            timestamp: expirationTimestamp.toString(),
            description: "Order expires in 5 minutes"
          },
          items: whatsappItems,
          subtotal: {
            value: subInPaise,
            offset: 100
          },
          tax: {
            value: taxInPaise,
            offset: 100,
            description: taxDescription || "Tax"
          }
          // shipping/discount can be added similarly
        }
      }
    }
  };

  const messagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactivePayload
  };

  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappAccessToken = process.env.WHATSAPP_TOKEN;
  if (!whatsappAccessToken) throw new Error("Missing WHATSAPP_TOKEN.");
  if (!whatsappPhoneNumberId) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID.");

  const apiUrl = `https://graph.facebook.com/v16.0/${whatsappPhoneNumberId}/messages`;

  try {
    const response = await axios.post(apiUrl, messagePayload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${whatsappAccessToken}`
      }
    });
    console.log("Razorpay order_details message sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending Razorpay interactive message:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendDynamicRazorpayInteractiveMessage };
