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
    
    const { orderItems, totalDominosPrice, baseprice } = await extractOrderDetails(msgBody);
    console.log("Extracted order details:", { orderItems, totalDominosPrice, baseprice });

    const minOrderAmount = process.env.MIN_ORDER_AMOUNT || 100; 
    const additionalDiscount = process.env.ADDITIONAL_DISCOUNT || 50;

    if (totalDominosPrice >= minOrderAmount) {
        const packingCharge = 20; 
        const tax = baseprice * 0.05;  

        // Example final price calculation
        let finalPrice = totalDominosPrice * 0.9; // 10% discount
        if (finalPrice < 1) {
            finalPrice = 1;
        }

        const breakdown = `🎉 **Good news!** You've unlocked an additional discount of ₹${additionalDiscount}!

- Base Price: ₹${baseprice}
- Additional Discount: ₹${additionalDiscount}
- Tax (5%): ₹${tax.toFixed(2)}
- Packing Charge: ₹${packingCharge}
- Total (Before Discount): ₹${totalDominosPrice.toFixed(2)}

**Final Price** (after 10% discount): ₹${finalPrice.toFixed(2)}
        `;

        await sendWhatsAppMessage(from, breakdown);

        // Store the finalPrice AND the orderItems, so we can use them in the next step
        storeSessionData(from, { finalPrice, orderItems, baseprice, tax });

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
        // Now send the interactive Razorpay message with the real items
        const referenceId = "ref_" + Date.now();  // or any unique ID
        const { orderItems, baseprice, tax, finalPrice } = sessionData;

        // Build the dynamic payload
        await sendDynamicRazorpayInteractiveMessage({
          to: from,
          referenceId,
          items: orderItems,            // array of items
          subtotal: baseprice,          // or sum of items
          taxAmount: tax,               // your 5% tax
          taxDescription: "5% GST",
          totalPayable: finalPrice      // final price to pay
        });

    } catch (error) {
        console.error("Failed to generate payment link or send RPay message:", error);
        await sendWhatsAppMessage(from, "Failed to initiate payment.");
    }
}

module.exports = { handleProductOffer, handlePaymentConfirmation };
