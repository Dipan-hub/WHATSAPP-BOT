// src/whatsapp.js
require('dotenv').config();
const axios = require('axios');

// We read these from our .env file
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Sends a WhatsApp text message using the Cloud API.
 * @param {string} to - The phone number (with country code) of the recipient. Example: "1234567890".
 * @param {string} message - The text content you want to send.
 */
async function sendWhatsAppMessage(to, message) {
  try {
    // The base URL for WhatsApp Cloud API calls
    const url = `https://graph.facebook.com/v15.0/${phoneNumberId}/messages`;

    // Make the POST request to WhatsApp Cloud API
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        text: { body: message }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log('Message sent successfully:', response.data);

    // ✅ Add row to Google Sheet after message is sent
    addRowToSheet([to, message, Math.floor(Date.now() / 1000), 1], process.env.SHEET_ID)
      .then(() => console.log('✅ Logged to Google Sheets'))
      .catch(error => console.error('❌ Error logging to Google Sheets:', error));


    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessage
};
