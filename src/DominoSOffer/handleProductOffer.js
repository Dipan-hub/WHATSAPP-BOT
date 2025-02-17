// handleProductOffer.js

const { sendWhatsAppMessage } = require('../whatsapp.js');
const { sendListMessage_NewHostel ,sendListMessage_OldHostel} = require('../AskAddress/whatsappList.js');
const { extractOrderDetails } = require('../orderProcessor.js');
const { generatePaymentLink } = require('../payment.js');
const { sendDynamicRazorpayInteractiveMessage } = require('../WhatsappXRazorPay/Whatsapp_razorpay_Integration.js');

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

    // Extract the first item's pID from the orderItems array
    const firstItemPID = parseFloat(orderItems[0]?.pID); 

    // Log the result to check
    console.log("\n\n\n\n\First Order Item pID:", firstItemPID,"\n\n\n\n\n\n");


    const minOrderAmount = parseFloat(process.env.DOM_MIN_ORDER_AMOUNT || 314); 
    const additionalDiscount = parseFloat(process.env.DOM_ADDITIONAL_DISCOUNT || 50);
    const packingCharge = parseFloat(process.env.DOM_PACKING_CHARGES || 20);

    if(firstItemPID<500)
    {

    if (sumSalePrice >= minOrderAmount) {
         
        const tax = basePrice * 0.05;

        // Example final price calculation
        console.log("---Base Price---", { basePrice });
        console.log("---additionalDiscount---", { additionalDiscount });
        console.log("---packingCharges---", { packingCharge });

        let finalPrice = (basePrice - additionalDiscount)* 1.05 + packingCharge; // 10% discount
        console.log("---Final Price---", { finalPrice });
        finalPrice = parseFloat(finalPrice);

        if (finalPrice < 1) {
            finalPrice = 1;
        }

        const breakdown = `🎉 **Good news!** You've unlocked a total discount of *${((basePrice-finalPicapoolPrice+45)/basePrice*100).toFixed(2)}%*!

- Base Price: ₹${basePrice}
- Delivery Charge: ~₹45~ (FREE)
- Tax (5%): ₹${tax.toFixed(2)}
- Packing Charge: ₹${packingCharge}
- *Total Savings* at Picapool: *₹${((basePrice-finalPicapoolPrice+45)).toFixed(2)}*!

The Best Dominos could have given you was around : *₹${finalPrice.toFixed(2)}*

**Final Price** at Picapool for your order: *₹${finalPicapoolPrice.toFixed(2)}*
        `;

        await sendWhatsAppMessage(from, breakdown);
        await sendWhatsAppMessage(918917602924, breakdown);

        // Store the finalPrice AND the orderItems, so we can use them in the next step
        storeSessionData(from, { finalPrice, orderItems, basePrice, tax ,firstItemPID});

        // Prompt the user with a list, or proceed
        await sendListMessage_NewHostel(from);
    } else {
        await sendWhatsAppMessage(
            from,
            `Hi! The minimum order value is ₹${minOrderAmount}. Please add more items.`
        );
    }

}

if(firstItemPID>500)
    {
        if (orderItems.length>9)
        {await sendWhatsAppMessage(
            from,
            `Hi! The minimum order is 9 items. Please split your order into ${Math.ceil(orderItems.length / 9)} part(s).`
        );}

        else if (sumSalePrice >= 201) {

        const tax = basePrice * 0.05;

        // Example final price calculation
        console.log("---Base Price---", { basePrice });

        let finalPrice = basePrice /1.05; // 10% discount
        console.log("---Final Price---", { finalPrice });
        finalPrice = parseFloat(finalPrice);

        if (finalPrice < 1) {
            finalPrice = 1;
        }

        const breakdown = `🎉 

👇 Here's the summary of your order:
        
💰 **Base Price:** ₹${basePrice}
   **Delivery Price** ~₹40~     
        
🔻 **Final Price** at Picapool for your order: *₹${basePrice}*😃✨
        `;
        

        await sendWhatsAppMessage(from, breakdown);
        await sendWhatsAppMessage(918917602924, breakdown);

        // Store the finalPrice AND the orderItems, so we can use them in the next step
        storeSessionData(from, { finalPrice, orderItems, basePrice, tax ,firstItemPID});

        // Prompt the user with a list, or proceed
        await sendListMessage_OldHostel(from);

}else {
    await sendWhatsAppMessage(
        from,
        `Hi! The minimum order value is *₹201*. Please add more items.`
    );
}
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
        

        const { orderItems, basePrice, tax, finalPrice ,firstItemPID} = sessionData;
        const referenceId = "ref_" + Date.now();

        let delivery = 0; // Initialize delivery variable
        let totalPayable = 0; // Initialize totalPayable variable
        console.log(`\n\n\n\n \n The gaaand faad value of firstItemPID is : ${firstItemPID}\n\n\n\n`);
        console.log(`\n\n\n\n \n The gaaand faad value of firstItemPID is : ${firstItemPID}\n\n\n\n`);
        console.log(`\n\n\n\n \n The gaaand faad value of firstItemPID is : ${firstItemPID}\n\n\n\n`);
  
        if (firstItemPID < 500) {
            delivery = process.env.DOM_PACKING_CHARGES || 20;
        
            // If your finalPrice does NOT include delivery, then do:
            totalPayable = finalPrice + delivery;
        } else if (firstItemPID > 500) {

            delivery = 0;
            totalPayable = finalPrice;
        }
        let taxAmount = (firstItemPID > 500) ? 0 : tax; // If firstItemPID > 500, set tax to 0, otherwise use the existing tax value

        // Otherwise, if finalPrice already includes it, set totalPayable = finalPrice
        // and pass delivery = 0.
        // For example:
        // const totalPayable = finalPrice;
        storeSessionData(from, { finalPrice, orderItems, basePrice, tax ,firstItemPID, selectedOption});

        // Now call WhatsApp function
        await sendDynamicRazorpayInteractiveMessage({
          to: from,
          referenceId,
          items: orderItems,       // array of items
          subtotal: basePrice,     // or sum of sale-price items
          taxAmount: taxAmount,          // 5% tax
          taxDescription: "GST",
          delivery,                // pass the 45 or 0
          totalPayable             // final total
        });

    } catch (error) {
        console.error("Failed to generate payment link or send RPay message:", error);
        await sendWhatsAppMessage(from, "Failed to initiate payment.");
    }
}
async function PaymentConfirmationMessage(from, status){
    const sessionData = getSessionData(from);
    if (!sessionData || !sessionData.finalPrice) {
        await sendWhatsAppMessage(from, "No payment found. Please try again.");
        return;
    }
    console.log("Payment Status Update:", JSON.stringify(status, null, 2));
    const { finalPrice, orderItems, basePrice, tax ,firstItemPID, selectedOption} = sessionData;
    console.log("Aaja llaga ja gal tha tha krdi krdi kirdi");
    console.log("Aaja llaga ja gal tha tha krdi krdi kirdi");
    console.log("Aaja llaga ja gal tha tha krdi krdi kirdi");
    console.log("Aaja llaga ja gal tha tha krdi krdi kirdi");
    console.log("Aaja llaga ja gal tha tha krdi krdi kirdi");
    console.log("Extracted order details:", { finalPrice, orderItems, basePrice, tax ,firstItemPID, selectedOption });

    console.log("Payment Status Update:", JSON.stringify(status, null, 2));

// Extracting the relevant payment details
const { id, payment, receipt, notes } = status;
const amount = payment.amount.value;
const paymentStatus = payment.status;
const transactionID = payment.transaction.id;
const recipient = status.recipient_id; 

const promoCode = notes?.promo || "No promo code applied";  // Handle the possibility of missing promo

// Extracting order item details
const itemNames = orderItems.map(item => item.name).join(" \n");
const referenceId = status.payment?.reference_id;  // Safely access the reference_id
let referenceIdLastThree = "N/A";

if (referenceId) {
  // Get the last 3 digits of the reference_id
  referenceIdLastThree = referenceId.slice(-3); // Using slice to get the last 3 characters
  console.log("Last three digits of reference_id:", referenceIdLastThree);
} else {
  console.log("Reference ID not found in the payment data.");
}


// Formatting the message for WhatsApp or another platform
const message = `
🎉 Woahh!! Your payment of *₹${amount/100}* has been successfully received! 🎉

Thank you for choosing *Picapool*. We're excited to process your order! 🚀

--------------------
Order ID: ${referenceIdLastThree}

Items Ordered:
${itemNames}
--------------------

Delivery Address: ${selectedOption || "Not Provided"}
Phone Number: ${recipient || "Not Provided"}

We're starting the processing of your order now, and it will be with you soon!

Thank you once again for trusting us. If you have any questions, feel free to reach out. 😊
`;

/*
const message = `
Woahh!! We have received ₹${amount/100} successfully!! 🎉

Order ID: ${referenceIdLastThree}


Items Ordered:
 - ${itemNames}


Address: ${selectedOption || "Not Provided"}
Phone Number: ${recipient || "Not Provided"}
`;
*/
console.log(message);

console.log("Order details:", message);
await sendWhatsAppMessage(recipient, message);
await sendWhatsAppMessage(918917602924, message);
await sendWhatsAppMessage(917224052216, message);
await sendWhatsAppMessage(918143405112, message);

// Optionally, you can send the message to WhatsApp or any other platform here

}

module.exports = { handleProductOffer, handlePaymentConfirmation , PaymentConfirmationMessage};
