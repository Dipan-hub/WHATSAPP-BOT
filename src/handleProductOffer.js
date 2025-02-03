const { sendWhatsAppMessage } = require('./whatsapp.js');
const { sendListMessage } = require('./whatsappList.js');
const { extractOrderDetails, calculateFinalPrice } = require('./orderProcessor.js');
const { generatePaymentLink } = require('./payment.js');
const { sendRazorpayInteractiveMessage } = require('./Whatsapp_razorpay_Integration');

// Accessing environment variables from .env file
const minOrderAmount = process.env.MIN_ORDER_AMOUNT;
const additionalDiscount = process.env.ADDITIONAL_DISCOUNT;

let sessionStore = {};

// Log when storing session data
function storeSessionData(userId, data) {
    console.log(`Storing session data for user ${userId}:`, data);
    sessionStore[userId] = data;
}

// Log when retrieving session data
function getSessionData(userId) {
    const data = sessionStore[userId] || null;
    console.log(`Retrieved session data for user ${userId}:`, data);
    return data;
}

async function handleProductOffer(from, msgBody) {
    console.log(`Received product offer message from ${from}: ${msgBody}`);
    
    // Extract order details from the incoming message and log the result
    const { orderItems, totalDominosPrice, baseprice } = extractOrderDetails(msgBody);
    console.log("Extracted order details:", { orderItems, totalDominosPrice, baseprice });

    // Check that there is at least one order item and the total meets the minimum order amount.
    if (orderItems.length > 0 && totalDominosPrice >= minOrderAmount) {
        const packingCharge = 20; // Fixed packing charge

        // Calculate tax based on the base price (before adjustments)
        const totalWithTaxAndPacking = baseprice;
        const tax = totalWithTaxAndPacking * 0.05;  // 5% tax

        // Calculate final price applying a 10% discount
        let finalPrice = totalDominosPrice * 0.9;
        if (finalPrice < 1) {
            finalPrice = 1;
        }
        
        // Create a breakdown message and log it
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

        console.log("Sending payment breakdown message:", breakdown);
        await sendWhatsAppMessage(from, breakdown);

        // Store the final price (in rupees) in the sessionStore and log it
        storeSessionData(from, { finalPrice });

        // Prompt the user for further actions
        await sendListMessage(from);
    } else {
        console.log("Order did not meet the minimum requirement. Sending error message.");
        await sendWhatsAppMessage(
            from,
            `Hi! 👋 The minimum order value for this offer is *₹${minOrderAmount}*, so could you please add a bit more to your order and try again? 😊`
        );
    }
}

// Note: Removed the extra parameter "sessionData" from the function signature to avoid duplicate declaration.
async function handlePaymentConfirmation(from, selectedOption) {
    // Retrieve session data and log it
    const sessionData = getSessionData(from);
    console.log("=== handlePaymentConfirmation: Session data ===");
    console.log(sessionData);

    if (sessionData && sessionData.finalPrice) {
        try {
            // Log the final price before conversion
            console.log("Generating payment link for finalPrice (rupees):", sessionData.finalPrice);
            // Convert rupees to paise (if required by your payment API)
            const finalPriceNumber = Number(sessionData.finalPrice);
            const finalPricePaise = Math.round(finalPriceNumber * 100);
            console.log("Final price in paise:", finalPricePaise);
            const PicapoolFinalPrice = finalPricePaise/100;
            
            // Call generatePaymentLink only once using the converted paise amount
            const paymentLink = await generatePaymentLink(PicapoolFinalPrice);
            console.log("Payment link generated:", paymentLink);

            // Send the payment link to the user
            await sendWhatsAppMessage(
                from,
                `Please complete your payment using the link below:\n\n🔗 ${paymentLink} \n\nMake sure to complete it within 5 minutes to avoid delays. Once payment is confirmed, we’ll place your order immediately. 🚀 \nLet us know once done! 😊`
            );


            sendRazorpayInteractiveMessage(from)
  .then((res) => console.log("Interactive message response:", res))
  .catch((err) => console.error("Error in interactive message:", err)); 



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
