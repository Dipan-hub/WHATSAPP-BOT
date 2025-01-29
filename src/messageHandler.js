// src/messageHandler.js

const { sendWhatsAppMessage } = require('./whatsapp.js');

async function handleIncomingMessage(from, message) {
    let responseText = "I didn't understand that.";

    if (message.toLowerCase() === "hi") {
        responseText = "Whatsup buddy !!";
    } else if (message.toLowerCase() === "hello") {
        responseText = "Hey there! How can I assist you today?";
    }

    await sendWhatsAppMessage(from, responseText);
}

module.exports = { handleIncomingMessage };
