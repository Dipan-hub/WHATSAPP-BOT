/******************************************************
 * // src/WhatsappXRazorPay/Whatsapp_razorpay_Integration.js
 * Whatsapp_razorpay_Integration.js
 ******************************************************/
require("dotenv").config();
const axios = require("axios");

/**
 * Send a dynamic order_details message to WhatsApp with:
 *  - All product items and each discounted sale price
 *  - Subtotal (sum of product sale prices)
 *  - Delivery fee (separate line item so sum matches)
 *  - Tax line
 *  - Final total = Subtotal + Delivery + Tax
 *
 * @param {Object} params
 * @param {string} params.to - The WhatsApp number in full format (e.g. "91XXXXXXXXXX")
 * @param {string} params.referenceId - A unique reference ID for the order
 * @param {Array}  params.items - Array of items => [ { name, price, image }, ... ]
 * @param {number} params.subtotal - Sum of all discounted product prices
 * @param {number} params.taxAmount - The total tax portion
 * @param {string} [params.taxDescription] - Optional label for tax (e.g., "5% GST")
 * @param {number} params.delivery - Delivery fee amount
 * @param {number} params.totalPayable - Final total = subtotal + delivery + tax
 */
async function sendDynamicRazorpayInteractiveMessage({
  to,
  referenceId,
  items = [],
  subtotal,
  taxAmount,
  taxDescription,
  delivery,
  totalPayable
}) {
  // Convert ₹ to paise
  const taxInPaise       = Math.round(taxAmount   * 100);
  const subInPaise       = Math.round(subtotal    * 100);
  const deliveryInPaise  = Math.round(delivery    * 100);
  const totalInPaise     = Math.round(totalPayable * 100);

  // 1) Build array of product line-items
  const productLineItems = items.map((item) => {
    // 'item.price' is the discounted price for this product
    const itemPriceInPaise = Math.round(item.price * 100);

    return {
      name: item.name,
      image: {
        link: item.image || "https://picapool-store.s3.ap-south-1.amazonaws.com/images/pool/scaled_1000091179.jpg"
      },
      amount: {
        value: itemPriceInPaise,
        offset: 100
      },
      quantity: 1
    };
  });

  // 2) Add "Delivery" as a separate line-item, so the math lines up in WhatsApp
  const deliveryItem = {
    name: "Delivery Fee",
    image: {
      link: "https://cdn-icons-png.flaticon.com/512/1428/1428436.png" // or your own small icon
    },
    amount: {
      value: deliveryInPaise,
      offset: 100
    },
    quantity: 1
  };

  // Combine product items + delivery item
  const whatsappItems = [...productLineItems, deliveryItem];

  // The "subtotal" in WhatsApp must match the sum of all item line-items (products + delivery).
  // So let's define officialSubtotalInPaise as subInPaise + deliveryInPaise:
  const officialSubtotalInPaise = subInPaise + deliveryInPaise;

  // Then total = officialSubtotal + tax
  // This must match the totalInPaise we pass to "total_amount"
  // i.e. totalInPaise = officialSubtotalInPaise + taxInPaise

  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now

  // Build the interactive 'order_details' payload
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
        // The final total the user has to pay
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
          // Our line items (products + delivery)
          items: whatsappItems,
          // The "subtotal" must be the sum of all line items (in paise).
          subtotal: {
            value: officialSubtotalInPaise,
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

  // 3) Final request payload to WhatsApp
  const messagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: interactivePayload
  };

  // 4) Use your phone number ID and token from environment
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_TOKEN;
  const apiUrl        = `https://graph.facebook.com/v16.0/${phoneNumberId}/messages`;

  // 5) Send it via axios
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
