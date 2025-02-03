// payment.js

const axios = require('axios');

// This function will generate a Razorpay payment link
async function generatePaymentLink(amount, name = "Dipan", phone = "8917602924") {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;  // Store this in your .env file
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET; // Store this in your .env file

    const amountInPaise = amount * 100;  // Convert to paise

    const paymentLinkData = {
        amount: amountInPaise,
        currency: 'INR',
        description: 'Payment for your order',
        customer: {
            name: name,
            contact: phone,
            email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        },
        notify: {
            sms: true,
            email: true,
        },
        reminder_enable: true,
        notes: {
            policy_name: 'Policy X',
        },
        callback_url: 'https://example-callback-url.com/',
        callback_method: 'get',
    };

    try {
        const response = await axios.post('https://api.razorpay.com/v1/payment_links', paymentLinkData, {
            auth: {
                username: razorpayKeyId,
                password: razorpayKeySecret,
            },
        });

        return response.data.short_url;
    } catch (error) {
        console.error('Error generating payment link:', error);
        throw error;
    }
}

module.exports = { generatePaymentLink };
