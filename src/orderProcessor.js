// orderProcessor.js

const fetch = require('node-fetch');  // For Node 18 and below; Node 18+ has global fetch.
const Papa = require('papaparse');

// Your published Google Sheets CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZSZaOjPBrejN1HsXWEGVnlWHei8G94s-NShyn7KcMXGF-gRXqQYIyU6i5eK1BF00u8SMnfZ2Vptyh/pub?output=csv';

const TAX_RATE = 0.05;            // 5% tax
const PACKING_FEE = 20;          // ₹20 packing fee
const PICA_POOL_DISCOUNT = 0.10;  // 10% discount per pizza
const EXTRA_DISCOUNT = 60;       // Example discount

/**
 * 1) Fetch & parse CSV from Google Sheets, returning a mapping like { '57': 299, '58': 259, ... }.
 */
async function fetchPriceData() {
  console.log('--- [fetchPriceData] Fetching CSV...');
  const response = await fetch(SHEET_CSV_URL);
  const csvText = await response.text();

  console.log('--- [fetchPriceData] Parsing CSV with Papa...');
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const priceMap = {};

  // The columns we expect in each row: 
  //  "Product", "Price (Original)", "Price (Discounted)", "Name", "Image URL"
  parsed.data.forEach((row) => {
    const productId = row['Product'];
    const originalPrice = row['Price (Original)'];
    // If you need the discounted price, you can store it as well
    const discountedPrice = row['Price (Discounted)'] || 0; 
    const productName = row['Name'] || "";
    const imageUrl = row['Image URL'] || "";

    if (productId && originalPrice) {
      priceMap[productId] = {
        price: originalPrice,    // numeric
        discountPrice: discountedPrice,
        name: productName,       // from "Name"
        image: imageUrl         // from "Image URL"
      };
    }
  });

  console.log('--- [fetchPriceData] Built priceMap:', priceMap);
  return priceMap;
}
  

/**
 * 2) Extract P_IDs from the user's message, sum MRP from the Google Sheets data,
 *    and apply discount/tax/packing fee.
 */
async function extractOrderDetails(message) {
  console.log("=== [extractOrderDetails] Incoming message ===");
  console.log(message);

  // (a) Fetch the price data from Google Sheets
  const priceData = await fetchPriceData();

  // (b) Prepare for capturing details
  let orderItems = [];
  let totalDominosPrice = 0;
  let baseprice = 0;

  // (c) Regex to find (P_ID:  <number>)
  const regex = /\(P_ID:\s*(\d+)\)/g;
  let match;
  
  console.log("--- [extractOrderDetails] Searching for '(P_ID: XXX)' patterns...");

  while ((match = regex.exec(message)) !== null) {
    const pID = match[1];
    if (priceData[pID]) {
      const itemData = priceData[pID];
      const numericPrice = itemData.price;  // Just the original price
      const itemName = itemData.name;       // "Farmhouse (Regular)", etc.
      const itemImage = itemData.image;     // The full image link

      console.log(` -> Found P_ID ${pID}: ${itemName}, Price = ${numericPrice}`);

      totalDominosPrice += numericPrice;

      // Collect the item details for later use
      orderItems.push({
        pID,
        name: itemName,
        price: numericPrice,  // store numeric price
        image: itemImage
      });
    } else {
      console.warn(`   Warning: No data for P_ID ${pID}`);
    }
  }
  
  // (e) baseprice is just the sum of MRPs before discount, etc.
  baseprice = totalDominosPrice;
  console.log("[extractOrderDetails] Base total (MRP sum) =", baseprice);

  // (f) Apply discount -> tax -> packing fee
  console.log(`[extractOrderDetails] Subtracting EXTRA_DISCOUNT of ₹${EXTRA_DISCOUNT}`);
  let afterDiscount = totalDominosPrice - EXTRA_DISCOUNT;
  
  console.log(`[extractOrderDetails] Applying TAX_RATE of ${TAX_RATE * 100}%`);
  let afterTax = afterDiscount * (1 + TAX_RATE);

  console.log(`[extractOrderDetails] Adding PACKING_FEE of ₹${PACKING_FEE}`);
  totalDominosPrice = afterTax + PACKING_FEE;

  console.log("[extractOrderDetails] Final 'Dominos' total =", totalDominosPrice.toFixed(2));
  console.log("[extractOrderDetails] Order items array:", orderItems);

  return {
    orderItems,
    totalDominosPrice: Number(totalDominosPrice.toFixed(2)),
    baseprice: Number(baseprice.toFixed(2))
  };
}

/**
 * 3) Calculate final price *with* Picapool discount on each item, plus tax, packing fee, minus extra discount.
 */
function calculateFinalPrice(orderItems, extraDiscount = EXTRA_DISCOUNT) {
  /*console.log("=== [calculateFinalPrice] Processing each order item for Picapool discount ===");
  
  let picapoolTotal = 0;
  
  orderItems.forEach(item => {
    // (a) 10% discount per pizza
    let discountedPrice = item.mrp * (1 - PICA_POOL_DISCOUNT);
    console.log(` -> P_ID ${item.pID} - Original: ₹${item.mrp}, Discounted (10% off): ₹${discountedPrice.toFixed(2)}`);
    picapoolTotal += discountedPrice;
  });

  console.log("[calculateFinalPrice] Sum after Picapool discount =", picapoolTotal.toFixed(2));

  // (b) Add 5% tax
  let tax = picapoolTotal * TAX_RATE;
  console.log(`[calculateFinalPrice] Tax @ 5% = ₹${tax.toFixed(2)}`);

  // (c) Add packing fee, subtract extra discount
  let finalPrice = picapoolTotal + tax + PACKING_FEE - extraDiscount;
  console.log(`[calculateFinalPrice] Adding packing fee ₹${PACKING_FEE}, subtracting extraDiscount ₹${extraDiscount}`);
  console.log("[calculateFinalPrice] Final Price =", finalPrice.toFixed(2));

  return {
    picapoolTotal: Number(picapoolTotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    finalPrice: Number(finalPrice.toFixed(2))
  };
  */
}

// Export your methods
module.exports = {
  extractOrderDetails,
  calculateFinalPrice
};
