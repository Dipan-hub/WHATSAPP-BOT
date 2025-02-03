// orderProcessor.js
const fetch = require('node-fetch');  // For Node 18 and below; Node 18+ has global fetch.
const Papa = require('papaparse');

// Your published Google Sheets CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZSZaOjPBrejN1HsXWEGVnlWHei8G94s-NShyn7KcMXGF-gRXqQYIyU6i5eK1BF00u8SMnfZ2Vptyh/pub?output=csv';

const TAX_RATE = 0.05;         // 5% tax
const PACKING_FEE = 20;       // ₹20 packing fee
const PICA_POOL_DISCOUNT = 0.10; // 10% discount per pizza
const EXTRA_DISCOUNT = 60;    // used in your code example

/**
 * Fetches and parses the CSV from Google Sheets, returns a mapping object:
 *   { '57': 299, '58': 259, ... }
 */
async function fetchPriceData() {
  const response = await fetch(SHEET_CSV_URL);
  const csvText = await response.text();
  
  // Parse CSV using PapaParse
  const parsed = Papa.parse(csvText, {
    header: true,        // Read first row as header
    dynamicTyping: true, // Convert numeric strings to numbers automatically
    skipEmptyLines: true
  });

  // Create an object like { '57': 299, '58': 259, ... }
  const priceMap = {};
  parsed.data.forEach(row => {
    // Adjust these keys based on the CSV headers:
    // "Product", "Price (Original)", ...
    const productId = row['Product'];
    const originalPrice = row['Price (Original)'];
    if (productId && originalPrice) {
      priceMap[productId] = originalPrice;
    }
  });

  return priceMap;
}

/**
 * Extracts the ordered P_IDs from the message and calculates total price
 * using data fetched from Google Sheets.
 */
async function extractOrderDetails(message) {
  console.log("=== extractOrderDetails: Incoming message ===");
  console.log(message);

  // 1) Load the price data from Google Sheets
  const priceData = await fetchPriceData();

  let orderItems = [];
  let totalDominosPrice = 0;
  let baseprice = 0;

  // Regular expression to find P_ID values
  const regex = /\(P_ID:\s*(\d+)\)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    const pID = match[1];
    console.log("Found P_ID:", pID);

    if (priceData[pID]) {
      const mrp = priceData[pID];  // Get original MRP from our fetched data
      console.log(`Price for P_ID ${pID}: ₹${mrp}`);
      totalDominosPrice += mrp;
      orderItems.push({ pID, mrp });
    } else {
      console.log(`Warning: Price data not found for P_ID ${pID}`);
    }
  }
  
  baseprice = totalDominosPrice;
  console.log("Base total before adjustments (MRP sum):", baseprice);

  // Apply adjustments: subtract EXTRA_DISCOUNT, then tax, then packing fee
  totalDominosPrice = (totalDominosPrice - EXTRA_DISCOUNT) * (1 + TAX_RATE) + PACKING_FEE;
  console.log("Adjusted totalDominosPrice (after discount, tax, and packing fee):", totalDominosPrice);
  console.log("Order items array:", orderItems);

  return { orderItems, totalDominosPrice, baseprice };
}

/**
 * Calculates final price with Picapool discount, etc.
 */
function calculateFinalPrice(orderItems, extraDiscount = EXTRA_DISCOUNT) {
  console.log("=== calculateFinalPrice: Processing each order item ===");
  
  let picapoolTotal = 0;
  
  orderItems.forEach(item => {
    let discountedPrice = item.mrp * (1 - PICA_POOL_DISCOUNT);
    console.log(`P_ID ${item.pID} - Original: ₹${item.mrp}, Discounted: ₹${discountedPrice.toFixed(2)}`);
    picapoolTotal += discountedPrice;
  });
  
  console.log("Total after applying Picapool discount:", picapoolTotal.toFixed(2));

  let tax = picapoolTotal * TAX_RATE;
  console.log("Tax (5%):", tax.toFixed(2));

  let finalPrice = picapoolTotal + tax + PACKING_FEE - extraDiscount;
  console.log("Final Price (after adding packing fee and subtracting extra discount):", finalPrice.toFixed(2));

  return {
    picapoolTotal: picapoolTotal.toFixed(2),
    tax: tax.toFixed(2),
    finalPrice: finalPrice.toFixed(2)
  };
}

module.exports = { extractOrderDetails, calculateFinalPrice };
