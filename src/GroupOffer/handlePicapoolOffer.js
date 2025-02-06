const { sendWhatsAppMessage } = require('./whatsapp.js');

function handlePicapoolOffer(from, message) {
    // Logic to handle messages with Z_ID
    sendWhatsAppMessage(from, "Picapool offer received.");
}

module.exports = { handlePicapoolOffer };
