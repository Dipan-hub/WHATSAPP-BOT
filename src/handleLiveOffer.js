const { sendWhatsAppMessage } = require('./whatsapp.js');

function handleLiveOffer(from, message) {
    // Logic to handle messages with L_ID
    sendWhatsAppMessage(from, "Live offer received.");
}

module.exports = { handleLiveOffer };
