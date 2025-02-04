/******************************************************
 * // src/WhatsappXRazorPay/Whatsapp_razorpay_Integration.js
 * Whatsapp_razorpay_Integration.js
 ******************************************************/
require("dotenv").config();
const axios = require("axios");

/**
 * Send a dynamic order_details message to WhatsApp with:
 *  - All product items and each final (discounted) sale price
 *  - Subtotal (sum of product prices)
 *  - Delivery fee (shown as a separate line item)
 *  - Tax line
 *  - Final total = Subtotal + Delivery + Tax
 *
 * WhatsApp checks that:
 *   sum(items[].amount.value * quantity) + ... = 'subtotal.value'
 *   'subtotal.value' + 'tax.value' = 'total_amount.value'
 *
 * So we must ensure the numeric sums match exactly.
 *
 * @param {Object} params
 * @param {string} params.to - The WhatsApp number in full format (e.g. "91XXXXXXXXXX")
 * @param {string} params.referenceId - A unique reference ID for the order
 * @param {Array}  params.items - Array of items => [ { name, price, image }, ... ]
 *   - 'price' here is the final discounted price for each product
 * @param {number} params.subtotal - Sum of discounted product prices (in ₹)
 * @param {number} params.taxAmount - The total tax portion (in ₹)
 * @param {string} [params.taxDescription] - Optional label for tax (e.g. "5% GST")
 * @param {number} params.delivery - Delivery fee amount (in ₹)
 * @param {number} params.totalPayable - Final total = subtotal + delivery + tax (in ₹)
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
  console.log("======== [sendDynamicRazorpayInteractiveMessage] ========");
  console.log("to:", to);
  console.log("referenceId:", referenceId);
  console.log("items (array):", items);
  console.log("subtotal (arg) => should match sum of discounted product prices:", subtotal);
  console.log("taxAmount (arg):", taxAmount);
  console.log("delivery (arg):", delivery);
  console.log("totalPayable (arg) => should be (subtotal + delivery + tax):", totalPayable);

  // 1) Convert the function inputs from ₹ to paise
  const taxInPaise      = Math.round(taxAmount * 100);
  const deliveryInPaise = Math.round(delivery  * 0);
  // We'll compute the sum of product line items from the "items" array,
  // rather than trusting the passed-in `subtotal` to avoid mismatch.

  // 2) Build array of product line-items for WhatsApp
  let sumOfProductsInPaise = 0;

  const productLineItems = items.map((item, index) => {
    const itemPriceInPaise = Math.round(item.price * 100);
    sumOfProductsInPaise += itemPriceInPaise;

    console.log(` -> item[${index}] "${item.name}": price=${item.price} => ${itemPriceInPaise} paise`);

    return {
      name: item.name || "No Name",
      image: {
        link: item.image ||
          "https://picapool-store.s3.ap-south-1.amazonaws.com/images/pool/scaled_1000091179.jpg"
      },
      amount: {
        value: itemPriceInPaise,
        offset: 100
      },
      quantity: 1
    };
  });

  console.log(`[DEBUG] sumOfProductsInPaise (from items) = ${sumOfProductsInPaise}`);

  // 3) Add "Delivery Fee" as a separate line-item, so the math lines up in WhatsApp
  const deliveryItem = {
    name: "Delivery Fee",
    image: {
      link: "https://cdn-icons-png.flaticon.com/512/1428/1428436.png"
    },
    amount: {
      value: deliveryInPaise,
      offset: 100
    },
    quantity: 1
  };

  // Combine product items + the delivery fee item
  const whatsappItems = [...productLineItems, deliveryItem];

  // 4) The official "subtotal" that WhatsApp expects is the sum of the item line-items
  //    i.e. product sum + delivery. We'll call this officialSubtotalInPaise:
  const officialSubtotalInPaise = sumOfProductsInPaise + deliveryInPaise;

  console.log(`[DEBUG] officialSubtotalInPaise (products + delivery) = ${officialSubtotalInPaise}`);

  // 5) The final total = officialSubtotalInPaise + taxInPaise
  const totalInPaise = officialSubtotalInPaise + taxInPaise;

  console.log(`[DEBUG] totalInPaise (subtotal + tax) = ${totalInPaise}`);

  // 6) Double-check against your totalPayable input
  const callerExpectedTotalPaise = Math.round(totalPayable * 100);
  if (callerExpectedTotalPaise !== totalInPaise) {
    console.warn(
      "[WARNING] totalPayable mismatch!",
      "You passed totalPayable =", totalPayable,
      `(${callerExpectedTotalPaise} paise), but from items/delivery/tax we got ${totalInPaise} paise.`
    );
    // It's up to you whether to override or to throw an error, etc.
  }

  // 7) Build the interactive 'order_details' payload
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
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
        // The final total the user has to pay (must match line-items + tax)
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
          // The "subtotal" in WhatsApp is the sum of line items (in paise)
          subtotal: {
            value: officialSubtotalInPaise,
            offset: 100
          },
          // The tax object
          tax: {
            value: taxInPaise,
            offset: 100,
            description: taxDescription || "Tax"
          }
        }
      }
    }
  };

  // 8) Final request payload to WhatsApp
  const messagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: interactivePayload
  };

  console.log("[DEBUG] Final messagePayload to send =>", JSON.stringify(messagePayload, null, 2));

  // 9) Use your phone number ID and token from environment
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_TOKEN;
  const apiUrl        = `https://graph.facebook.com/v16.0/${phoneNumberId}/messages`;

  // 10) Send it via axios
  try {
    const response = await axios.post(apiUrl, messagePayload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });
    console.log("Razorpay order_details message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending dynamic Razorpay message:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendDynamicRazorpayInteractiveMessage };
