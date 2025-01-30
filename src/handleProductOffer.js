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

    if (orderItems.length > 0) {
        const { picapoolTotal, tax, finalPrice } = calculateFinalPrice(orderItems);
        const responseText = `Total price before tax: ₹${totalDominosPrice}\nDiscounted total: ₹${picapoolTotal}\nTax: ₹${tax}\nFinal price (after discounts and including tax): ₹${finalPrice}`;
        await sendWhatsAppMessage(from, responseText);

        // Store the final price in session
        storeSessionData(from, { finalPrice });

        // Prompt the user to select a location or further actions
        await sendListMessage(from);
    } else {
        await sendWhatsAppMessage(from, "No valid order items found in your message.");
    }
}

async function handlePaymentConfirmation(from, selectedOption) {
    const sessionData = getSessionData(from);

    if (sessionData && sessionData.finalPrice) {
        try {
            const paymentLink = await generatePaymentLink(sessionData.finalPrice);
            await sendWhatsAppMessage(from, `Please complete your payment by visiting this link: ${paymentLink}`);
        } catch (error) {
            console.error("Failed to generate payment link:", error);
            await sendWhatsAppMessage(from, "Failed to generate payment link.");
        }
    } else {
        await sendWhatsAppMessage(from, "Sorry, we couldn't retrieve your order details for payment.");
    }
}

module.exports = { handleProductOffer, handlePaymentConfirmation };
