const fs = require('fs'); // Import the file system module
const { sendWhatsAppMessage } = require('./whatsapp'); // Import the sendWhatsAppMessage function

/**
 * Read phone numbers from a file and send messages.
 * @param {string} filename - The path to the file containing phone numbers.
 * @param {string} message - The message to send to each phone number.
 */
async function sendMessagesFromFile(filename, message) {
  try {
    console.log(`Reading phone numbers from file: ${filename}`);

    const data = fs.readFileSync(filename, 'utf8');
    
    // Log the raw data read from the file
    console.log(`Data read from file:\n${data}`);

    const phoneNumbers = data.split(','); // Split by commas
    console.log(`Phone numbers extracted: ${phoneNumbers}`);

    for (const phoneNumber of phoneNumbers) {
      const trimmedNumber = phoneNumber.trim();
      
      if (trimmedNumber) {
        console.log(`Sending message to: ${trimmedNumber}`);
        await sendWhatsAppMessage(trimmedNumber, message); // Call the imported function
        console.log(`Message sent to: ${trimmedNumber}`);
      } else {
        console.log('Empty phone number encountered, skipping...');
      }
    }
  } catch (error) {
    console.error(`Failed to read file: ${error.message}`);
  }
}

// Example usage:
// File '../phoneNumbers.txt' contains the numbers and we want to send a message.
const message = "Hello, this is Picapool -- Running this script!"; // Message to send
sendMessagesFromFile('./src/phoneNumbers.txt', message); // Use relative path to the text file

/*
How to run 

node src/sendBroadCastMessages.js
*/