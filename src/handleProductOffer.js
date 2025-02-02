const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');
const { extractOrderDetails, calculateFinalPrice } = require('./orderProcessor.js');
const { generatePaymentLink } = require('./payment.js');

// Accessing environment variables from .env file
const minOrderAmount = process.env.MIN_ORDER_AMOUNT;
const additionalDiscount = process.env.ADDITIONAL_DISCOUNT;

let sessionStore = {};

function storeSessionData(userId, data) {
    sessionStore[userId] = data;
}

function getSessionData(userId) {
    return sessionStore[userId] || null;
}

async function handleProductOffer(from, msgBody) {
    console.log(`Received product offer message from ${from}: ${msgBody}`);
    const { orderItems, totalDominosPrice,baseprice } = extractOrderDetails(msgBody);

    if (orderItems.length > 0 && totalDominosPrice >= minOrderAmount) {
        // Tax and packing charge calculations
        const packingCharge = 20; // Fixed packing charge
        
        // Calculate final price before discount
        const totalWithTaxAndPacking = baseprice;
        const tax = totalWithTaxAndPacking * 0.05;  // 5% tax
        
        // Picapool 10% discount
        let finalPrice = totalDominosPrice * 0.9;
        if (finalPrice < 1) {
            finalPrice = 1;
        }
        
        // Payment breakdown
        const breakdown = ` 🎉 **Good news!** You've unlocked an additional discount of *₹${additionalDiscount}*!

The best Domino's could have given you was *₹${totalDominosPrice.toFixed(2)}*!

Here’s the detailed breakdown:

🧾 **Payment Breakdown**:
- Base Price: *₹${totalWithTaxAndPacking}*
- Additional Discount: *₹${additionalDiscount}*
- Tax (5%): *₹${tax.toFixed(2)}*
- Packing Charge: *₹${packingCharge}*
- Total Price (Before Discount): *₹${totalDominosPrice.toFixed(2)}*

🏷️ **Picapool Discount**:
- 10% Discount: *₹${(totalDominosPrice * 0.1).toFixed(2)}*

🎯 **Final Price**: *₹${finalPrice.toFixed(2)}*

After applying a *10%* discount, the final price is just *₹${finalPrice.toFixed(2)}* 🎯
        `;

        await sendWhatsAppMessage(from, breakdown);

       /* const responseText = `🎉 **Good news!** You've unlocked an additional discount of *₹${additionalDiscount}*!

The best Domino's could have given you was *₹${totalDominosPrice.toFixed(2)}*!

But with Picapool, after adding taxes and charges, your total would be *₹${totalWithTaxAndPacking.toFixed(2)}*, and 

Here’s the detailed breakdown:
${breakdown}
        `;

        await sendWhatsAppMessage(from, responseText);*/

        // Store the final price in session
        storeSessionData(from, { finalPrice });

        // Prompt the user to select a location or further actions
        await sendListMessage(from);
    } else {
        await sendWhatsAppMessage(from, `Hi! 👋 The minimum order value for this offer is *₹${minOrderAmount}*, so could you please add a bit more to your order and try again? 😊`);
    }
}

async function handlePaymentConfirmation(from, selectedOption,sessionData) {
    const sessionData = getSessionData(from);
    console.log("=== handlePaymentConfirmation: Session data ===");
    console.log(sessionData);

    if (sessionData && sessionData.finalPrice) {
        try {
            // Log the final price before conversion
            console.log("Generating payment link for finalPrice (rupees):", sessionData.finalPrice);
            // Convert rupees to paise (if required by your API)
            const finalPriceNumber = Number(sessionData.finalPrice);
            const finalPricePaise = Math.round(finalPriceNumber * 100);
            console.log("Final price in paise:", finalPricePaise);
            
            const paymentLink = await generatePaymentLink(finalPricePaise);
            console.log("Payment link generated:", paymentLink);

            const paymentLink = await generatePaymentLink(sessionData.finalPrice);
            await sendWhatsAppMessage(from,`Please complete your payment using the link below:\n\n🔗 ${paymentLink} \n\nMake sure to complete it within 5 minutes to avoid delays. Once payment is confirmed, We’ll place your order immediately. 🚀 \nLet us know once done! 😊`);
        } catch (error) {
            console.error("Failed to generate payment link:", error);
            await sendWhatsAppMessage(from, "Failed to generate payment link.");
        }
    } else {
        console.error("Session data is missing or finalPrice is not available.");
        await sendWhatsAppMessage(from, "Sorry, we couldn't retrieve your order details for payment.");
    }
}

module.exports = { handleProductOffer, handlePaymentConfirmation };
