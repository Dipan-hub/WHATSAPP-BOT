// src/messageHandler.js
const { sendWhatsAppMessage } = require('./whatsapp.js');
const { extractOrderDetails, calculateFinalPrice } = require('./orderProcessor.js');
const { sendListMessage } = require('./whatsappList.js');

async function handleIncomingMessage(from, message) {
    /*const { orderItems, totalDominosPrice } = extractOrderDetails(message);
    
    if (orderItems.length === 0) {
        await sendWhatsAppMessage(from, "Oops! 😓 We couldn't detect any valid order items. Please ensure your order contains valid P_IDs.");
        return;
    }

    // Calculate price breakdown
    let extraDiscount = 60; // You can modify this dynamically
    const { picapoolTotal, tax, finalPrice } = calculateFinalPrice(orderItems, extraDiscount);

    // Check if order meets minimum value
    if (finalPrice >= 318) {
        await sendWhatsAppMessage(from, `Awesome! 🎉 Your order meets the minimum requirement of ₹318. Let’s check if we can add more discounts for you. 🤑 Give us a moment !!`);
    } else {
        await sendWhatsAppMessage(from, `Hi! 👋 The minimum order value for this offer is ₹318, so could you please add a bit more to your order and try again? 😊`);
        return;
    }

    // Send final discount message
    await sendWhatsAppMessage(from, `Great news! 🎉 We’ve added an extra discount of ₹${extraDiscount} for you. 🤑\nThe Best Domino's could have given you was ₹${totalDominosPrice}! \n\nYour final price at Picapool is now ₹${finalPrice}! 🎯`);

    // Send Location Details
    await sendListMessage(from);
    */
}

module.exports = { handleIncomingMessage };
