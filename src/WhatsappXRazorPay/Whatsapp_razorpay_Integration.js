require("dotenv").config();
const axios = require("axios");

// A known-good fallback image (PNG/JPG).
// Make sure this link truly returns PNG/JPEG, not WebP.
const FALLBACK_IMAGE_URL = "https://picapool-store.s3.ap-south-1.amazonaws.com/images/pool/scaled_1000091178.jpg";

// Helper function to split a long name into 2 lines
function formatItemName(rawName) {
  if (!rawName) return "No Name";

  // If it's not too long, return as is
  const LINE_CUTOFF = 30; // First line max length
  if (rawName.length <= LINE_CUTOFF) {
    return rawName;
  }

  // Otherwise, split into two lines
  const line1 = rawName.substring(0, LINE_CUTOFF);
  // We'll show the next chunk on a second line; choose your own limit
  const line2 = rawName.substring(LINE_CUTOFF, LINE_CUTOFF * 2);

  // If there's more after the second line, we *simply* cut it off (no "..." added).
  return line1 + "\n" + line2;
}

/**
 * Send a dynamic order_details message to WhatsApp with:
 *  - All product items and each final (discounted) sale price
 *  - Subtotal (sum of product prices)
 *  - Delivery fee (shown as a separate line item)
 *  - Tax line
 *  - Final total = Subtotal + Delivery + Tax
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
  console.log("subtotal (arg):", subtotal);
  console.log("taxAmount (arg):", taxAmount);
  console.log("delivery (arg):", delivery);
  console.log("totalPayable (arg):", totalPayable);

  // 1) Convert ₹ to paise
  const taxInPaise      = Math.round(taxAmount * 100);
  const deliveryInPaise = Math.round(delivery  * 100);

  // 2) Build array of product line-items for WhatsApp
  let sumOfProductsInPaise = 0;
  const productLineItems = items.map((item, index) => {
    const itemPriceInPaise = Math.round(item.price * 100);
    sumOfProductsInPaise += itemPriceInPaise;

    // If there's no image or if the URL *includes* ".webp" (case-insensitive),
    // then fallback to a known-good PNG/JPG.
    let safeImageLink = item.image;
    if (
      !safeImageLink ||
      safeImageLink.toLowerCase().includes(".webp")
    ) {
      safeImageLink = FALLBACK_IMAGE_URL;
    }

    // Format the name to 2 lines if it's very long
    const safeItemName = formatItemName(item.name);

    console.log(
      ` -> item[${index}] "${safeItemName}": price=${item.price} => ${itemPriceInPaise} paise, image=${safeImageLink}`
    );

    return {
      name: safeItemName,
      image: {
        link: safeImageLink
      },
      amount: {
        value: itemPriceInPaise,
        offset: 100
      },
      quantity: 1
    };
  });

  console.log(`[DEBUG] sumOfProductsInPaise (from items) = ${sumOfProductsInPaise}`);

  // 3) Add "Delivery Fee" as a separate line-item (also PNG fallback).
  const deliveryItem = {
    name: "Delivery & Packing Fee",
    image: {
      link: "https://static.vecteezy.com/system/resources/thumbnails/019/796/973/small_2x/motorbike-delivery-man-logo-icon-symbol-template-free-vector.jpg"
    },
    amount: {
      value: deliveryInPaise,
      offset: 100
    },
    quantity: 1
  };

  // Combine product items + the delivery fee item
  const whatsappItems = [...productLineItems, deliveryItem];

  // 4) officialSubtotalInPaise = sum of items
  const officialSubtotalInPaise = sumOfProductsInPaise + deliveryInPaise;
  console.log(`[DEBUG] officialSubtotalInPaise (products + delivery) = ${officialSubtotalInPaise}`);

  // 5) final total = officialSubtotalInPaise + taxInPaise
  const totalInPaise = officialSubtotalInPaise + taxInPaise;
  console.log(`[DEBUG] totalInPaise (subtotal + tax) = ${totalInPaise}`);

  // 6) Double-check user-passed totalPayable
  const callerExpectedTotalPaise = Math.round(totalPayable * 100);
  if (callerExpectedTotalPaise !== totalInPaise) {
    console.warn(
      "[WARNING] totalPayable mismatch!",
      "You passed totalPayable =", totalPayable,
      `(${callerExpectedTotalPaise} paise), but from items/delivery/tax we got ${totalInPaise} paise.`
    );
  }

  // 7) Build the interactive 'order_details' payload
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
  const interactivePayload = {
    type: "order_details",
    body: {
      text: "Here are your order details. Tap 'Review and Pay' to proceed."
    },
    footer: {
      text: "Order expires in 10 minutes."
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
              configuration_name:
                process.env.RAZORPAY_CONFIG_NAME || "PP_Payment_Test",
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
            description: "Order expires in 10 minutes"
          },
          // Our line items
          items: whatsappItems,
          // Subtotal
          subtotal: {
            value: officialSubtotalInPaise,
            offset: 100
          },
          // Tax
          tax: {
            value: taxInPaise,
            offset: 100,
            description: taxDescription || "Tax"
          }
        }
      }
    }
  };

  // 8) Final request payload
  const messagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: interactivePayload
  };

  console.log("[DEBUG] Final messagePayload =>", JSON.stringify(messagePayload, null, 2));

  // 9) Use phone number ID & token from environment
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_TOKEN;
  const apiUrl        = `https://graph.facebook.com/v16.0/${phoneNumberId}/messages`;

  // 10) Send via axios
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
    console.error(
      "Error sending dynamic Razorpay message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

module.exports = { sendDynamicRazorpayInteractiveMessage };
