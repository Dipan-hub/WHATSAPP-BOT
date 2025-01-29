// src/addressValidator.js

const allowedAddresses = [
    "Ramanujan", "Raman", "Kalam", "Sarabhai", "Charaka", "Vyasa"
    // Add any other addresses here
  ];
  
  function validateAddress(address) {
    const lowercasedAddress = address.toLowerCase();
    const isValid = allowedAddresses.some(validAddress =>
      lowercasedAddress.includes(validAddress.toLowerCase())
    );
    return isValid;
  }
  
  module.exports = { validateAddress };
  