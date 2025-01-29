const { sendWhatsAppMessage } = require('./whatsapp.js');
const { extractOrderDetails } = require('./orderProcessor.js');
const { calculateFinalPrice } = require('./orderProcessor.js');
const { validateAddress } = require('./addressValidator.js');
const axios = require('axios');

// Handle incoming address request and validate
async function handleAddressRequest(from, message, finalPrice, name, phone) {
  const isValidAddress = validateAddress(message);

  if (!isValidAddress) {
    await sendWhatsAppMessage(from, "Invalid address. Please provide a valid address.");
    return;
  }

  // Address is valid, generate payment link
  try {
    const paymentLink = await generatePaymentLink(finalPrice, name, phone);
    await sendWhatsAppMessage(from, `Here is the payment link [${paymentLink}]. Please pay within 5 minutes for smooth processing.`);
  } catch (error) {
    await sendWhatsAppMessage(from, 'Error generating payment link. Please try again later.');
  }
}


// Razorpay payment link generation function
async function generatePaymentLink(amount, name, phone) {
  try {
    // Convert the amount to paise (Razorpay API requires amount in paise)
    const amountInPaise = amount * 100;

    // Prepare the payment link data
    const paymentLinkData = {
      amount: amountInPaise,
      currency: 'INR',
      description: 'Payment for your order',
      customer: {
        name: name,
        contact: phone,
        email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, // Placeholder email
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      callback_url: process.env.CALLBACK_URL || 'https://example-callback-url.com/', // Replace with actual callback URL
      callback_method: 'get',
    };

    // Send POST request to Razorpay API to generate payment link
    const response = await axios.post('https://api.razorpay.com/v1/payment_links', paymentLinkData, {
      auth: {
        username: process.env.RAZORPAY_KEY_ID,  // Razorpay Key ID from environment variables
        password: process.env.RAZORPAY_KEY_SECRET, // Razorpay Key Secret from environment variables
      },
    });

    // Return the generated payment link URL
    return response.data.short_url;
  } catch (error) {
    console.error('Error generating payment link:', error);
    throw new Error('Payment link generation failed');
  }
}

async function handleIncomingMessage(from, message) {
  const { orderItems } = extractOrderDetails(message);
  if (orderItems.length === 0) {
    await sendWhatsAppMessage(from, "Oops! 😓 We couldn't detect any valid order items. Please ensure your order contains valid P_IDs.");
    return;
  }

  // Step 1: Check if the total price is above the minimum amount
  let { finalPicapoolPrice, tax, totalOriginalPrice } = calculateFinalPrice(orderItems, process.env.ADDITIONAL_DISCOUNT);

  // Step 2: If the price meets the minimum requirement, apply additional discount
  const minOrderValue = parseFloat(process.env.MIN_ORDER_AMOUNT);
  // Step 2: If the price meets the minimum requirement, apply additional discount
  if (finalPicapoolPrice >= process.env.MIN_ORDER_AMOUNT) {
    await sendWhatsAppMessage(from, `Awesome! 🎉 Your order meets the minimum requirement of ₹${minOrderValue}. Let’s check if we can add more discounts for you. 🤑 Give us a moment!!`);
} else {
  await sendWhatsAppMessage(from, `Hi! 👋 The minimum order value for this offer is ₹${minOrderValue}, so could you please add a bit more to your order and try again? 😊`);
  return;
}

// Step 3: Apply the additional discount and send the summary
const additionalDiscount = parseFloat(process.env.ADDITIONAL_DISCOUNT);
const finalPriceWithDiscount = finalPicapoolPrice - additionalDiscount;

await sendWhatsAppMessage(from, `Great news! 🎉 We’ve added an extra discount of ₹${additionalDiscount} for you. 🤑
The Best Domino's could have given you was ₹${totalOriginalPrice}! 

Your final price at Picapool is now ₹${finalPriceWithDiscount}! 🎯`);

// Step 4: Ask for the address
await sendWhatsAppMessage(from, "May I know where you'd like your orders to be delivered? 📍🏠");

// Now wait for the user to respond with their address
// (Assume the response goes to handleAddressRequest function)
}

module.exports = { handleIncomingMessage, handleAddressRequest };
