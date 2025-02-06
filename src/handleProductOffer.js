// handleProductOffer.js

const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');
const { extractOrderDetails } = require('./orderProcessor.js');
const { generatePaymentLink } = require('./payment.js');
const { sendDynamicRazorpayInteractiveMessage } = require('./WhatsappXRazorPay/Whatsapp_razorpay_Integration.js');

let sessionStore = {};

function storeSessionData(userId, data) {
    console.log(`Storing session data for user ${userId}:`, data);
    sessionStore[userId] = data;
}

function getSessionData(userId) {
    const data = sessionStore[userId] || null;
    console.log(`Retrieved session data for user ${userId}:`, data);
    return data;
}

async function handleProductOffer(from, msgBody) {
    console.log(`Received product offer from ${from}: ${msgBody}`);
    
    const { orderItems, sumSalePrice, basePrice ,finalPicapoolPrice } = await extractOrderDetails(msgBody);
    console.log("Extracted order details:", { orderItems, sumSalePrice, basePrice });

    const minOrderAmount = process.env.DOM_MIN_ORDER_AMOUNT || 100; 
    const additionalDiscount = 30 ; //process.env.ADDITIONAL_DISCOUNT || 50;

    if (sumSalePrice >= minOrderAmount) {
        const packingCharge = 20; 
        const tax = basePrice * 0.05;

        // Example final price calculation
        let finalPrice = (basePrice - additionalDiscount)* 1.05 + packingCharge; // 10% discount
        if (finalPrice < 1) {
            finalPrice = 1;
        }

        const breakdown = `🎉 **Good news!** You've unlocked an additional discount of ₹${additionalDiscount}!

- Base Price: ₹${basePrice}
- Additional Discountdddddddddddd: ₹${additionalDiscount}
- Tax (5%): ₹${tax.toFixed(2)}
- Packing Charge: ₹${packingCharge}
- The Best Dominos could have given you Total (Before PP Discount): ₹${finalPrice.toFixed(2)}

**Final Price** (after 10% discount): ₹${finalPicapoolPrice.toFixed(2)}
        `;

        await sendWhatsAppMessage(from, breakdown);

        // Store the finalPrice AND the orderItems, so we can use them in the next step
        storeSessionData(from, { finalPrice, orderItems, basePrice, tax });

        // Prompt the user with a list, or proceed
        await sendListMessage(from);
    } else {
        await sendWhatsAppMessage(
            from,
            `Hi! The minimum order value is ₹${minOrderAmount}. Please add more items.`
        );
    }
}

// Payment confirmation after user selects an option from the list, etc.
async function handlePaymentConfirmation(from, selectedOption) {
    const sessionData = getSessionData(from);
    if (!sessionData || !sessionData.finalPrice) {
        await sendWhatsAppMessage(from, "No order details found. Please start again.");
        return;
    }

    try {

        // Optionally generate your external link:
        //const finalPriceNumber = sessionData.finalPrice;
        // const paymentLink = await generatePaymentLink(finalPriceNumber);
        /*
        await sendWhatsAppMessage(
            from,
            `Please complete your payment using the link:\n${paymentLink}\n\nOr use the button below.`
        );
        */


        // Suppose your final price already includes tax & packingCharge, 
        // but let's say we also have a fixed delivery = 45
        const delivery = 20;

        const { orderItems, basePrice, tax, finalPrice } = sessionData;
        const referenceId = "ref_" + Date.now();

        // If your finalPrice does NOT include delivery, then do:
        const totalPayable = finalPrice + delivery;

        // Otherwise, if finalPrice already includes it, set totalPayable = finalPrice
        // and pass delivery = 0.
        // For example:
        // const totalPayable = finalPrice;

        // Now call WhatsApp function
        await sendDynamicRazorpayInteractiveMessage({
          to: from,
          referenceId,
          items: orderItems,       // array of items
          subtotal: basePrice,     // or sum of sale-price items
          taxAmount: tax,          // 5% tax
          taxDescription: "GST",
          delivery,                // pass the 45 or 0
          totalPayable             // final total
        });

    } catch (error) {
        console.error("Failed to generate payment link or send RPay message:", error);
        await sendWhatsAppMessage(from, "Failed to initiate payment.");
    }
}

module.exports = { handleProductOffer, handlePaymentConfirmation };
