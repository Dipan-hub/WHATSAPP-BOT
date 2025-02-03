// src/WhatsappXRazorPay/Whatsapp_razorpay_Integration.js
require("dotenv").config();
const axios = require("axios");

/**
 * Send dynamic order_details with real item name and image
 */
async function sendDynamicRazorpayInteractiveMessage({
  to,
  referenceId,
  items,
  subtotal,
  taxAmount,
  taxDescription,
  totalPayable
}) {
  // Convert ₹ to paise
  //const totalInPaise = Math.round(totalPayable * 100);
  const taxInPaise   = Math.round(taxAmount   * 100);
  const subInPaise   = Math.round(subtotal    * 100);
  const totalInPaise = taxInPaise+subInPaise;

  // Build items array for WhatsApp
  const whatsappItems = items.map((item) => {
    const itemPriceInPaise = Math.round(item.price * 100);
    return {
      // Use the actual name from the CSV
      name: item.name, 
      image: {
        // Use the actual link from the CSV if present, else fallback
        link: item.image || "https://picapool-store.s3.ap-south-1.amazonaws.com/images/pool/scaled_1000091179.jpg"
      },
      amount: {
        value: itemPriceInPaise,
        offset: 100
      },
      quantity: 1
    };
  });

  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 min

  const interactivePayload = {
    type: "order_details",
    body: {
      text: "Here are your order details. Tap 'Review and Pay' to proceed."
    },
    footer: {
      text: "Order expires in 5 minutes."
    },
    action: {
      name: "review_and_pay",
      parameters: {
        reference_id: referenceId,
        type: "digital-goods",
        payment_settings: [
          {
            type: "payment_gateway",
            payment_gateway: {
              type: "razorpay",
              configuration_name: process.env.RAZORPAY_CONFIG_NAME || "PP_Payment_Test",
              razorpay: {
                receipt: "receipt_" + referenceId,
                notes: { promo: "testpromo" }
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
        }
      }
    }
  };

  const messagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: interactivePayload
  };

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_TOKEN;

  const apiUrl = `https://graph.facebook.com/v16.0/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(apiUrl, messagePayload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });
    console.log("Razorpay order_details message sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending dynamic Razorpay message:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendDynamicRazorpayInteractiveMessage };
