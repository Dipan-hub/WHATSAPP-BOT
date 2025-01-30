// handleProductOffer.js

const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');  // Ensure this line is correct
const { extractOrderDetails, calculateFinalPrice } = require('./orderProcessor.js');
const { generatePaymentLink } = require('./payment.js');

let sessionStore = {};

function storeSessionData(userId, data) {
    sessionStore[userId] = data;
}

function getSessionData(userId) {
    return sessionStore[userId] || null;
}

async function handleProductOffer(from, msgBody) {
    console.log(`Received product offer message from ${from}: ${msgBody}`);
    const { orderItems, totalDominosPrice } = extractOrderDetails(msgBody);

    if (orderItems.length > 0 && totalDominosPrice >= 314) {
        //const { picapoolTotal, tax, finalPrice } = calculateFinalPrice(orderItems);
        let finalPrice = 0.9 * totalDominosPrice;
        if(finalPrice<1){
            finalPrice=1;
        }
        const responseText = `Great news! 🎉 We’ve added an extra discount of *₹60* for you. 🤑 \n\nThe Best Domino's could have given you was *₹${totalDominosPrice}*! \n\nYour final price at Picapool is now *₹${finalPrice}*! 🎯`;

        await sendWhatsAppMessage(from, responseText);

        // Store the final price in session
        storeSessionData(from, { finalPrice });

        // Prompt the user to select a location or further actions
        await sendListMessage(from);
    } else {
        await sendWhatsAppMessage(from, "Hi! 👋 The minimum order value for this offer is *₹314*, so could you please add a bit more to your order and try again? 😊");
    }
}

async function handlePaymentConfirmation(from, selectedOption) {
    const sessionData = getSessionData(from);

    if (sessionData && sessionData.finalPrice) {
        try {
            const paymentLink = await generatePaymentLink(sessionData.finalPrice);
            await sendWhatsAppMessage(from,`Please complete your payment using the link below:\n\n🔗 ${paymentLink} \n\nMake sure to complete it within 5 minutes to avoid delays. Once payment is confirmed, We’ll place your order immediately. 🚀 \nLet us know once done! 😊`);
        } catch (error) {
            console.error("Failed to generate payment link:", error);
            await sendWhatsAppMessage(from, "Failed to generate payment link.");
        }
    } else {
        await sendWhatsAppMessage(from, "Sorry, we couldn't retrieve your order details for payment.");
    }
}

module.exports = { handleProductOffer, handlePaymentConfirmation };
