// orderProcessor.js

const fetch = require('node-fetch');  // For Node 18 and below; Node 18+ has global fetch.
const Papa = require('papaparse');

// Your published Google Sheets CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZSZaOjPBrejN1HsXWEGVnlWHei8G94s-NShyn7KcMXGF-gRXqQYIyU6i5eK1BF00u8SMnfZ2Vptyh/pub?output=csv';

// Constants for discount and fees
const ADDITIONAL_DISCOUNT = 60;    // Subtracted once from total MRP sum
const PICAPOOL_DISCOUNT_RATE = 0.1; // 10% discount
const TAX_RATE = 0.05;             // 5% tax
const DELIVERY_FEE = 0;           // Flat delivery cost

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

  // (a) Fetch the price data (MRP) from Google Sheets
  const priceData = await fetchPriceData();

  // (b) Prepare for capturing details
  let orderItems = [];
  let basePrice = 0;

  // (c) Regex to find patterns like (P_ID:  <number>)
  const regex = /\(P_ID:\s*(\d+)\)/g;
  let match;

  console.log("--- [extractOrderDetails] Searching for '(P_ID: XXX)' patterns...");

  // Collect each product's MRP
  let productMRPs = []; // just store the numerical MRP for each found P_ID

  while ((match = regex.exec(message)) !== null) {
    const pID = match[1];
    if (priceData[pID]) {
      const itemData = priceData[pID];
      const numericMRP = itemData.price; // MRP from the sheet
      const itemName = itemData.name;    // e.g. "Farmhouse (Regular)"
      const itemImage = itemData.image;  // Full image link

      console.log(` -> Found P_ID ${pID}: ${itemName}, MRP = ${numericMRP}`);

      // Keep track of the item so we can finalize salePrice later
      orderItems.push({
        pID,
        name: itemName,
        mrp: numericMRP,
        image: itemImage
      });

      basePrice += numericMRP;
      productMRPs.push(numericMRP);
    } else {
      console.warn(`   Warning: No data for P_ID ${pID}`);
    }
  }

  console.log("[extractOrderDetails] Base total (MRP sum) =", basePrice);

  // (d) Now apply Additional discount of ₹60, then Picapool discount of 10%
  // We'll compute the final net total (sumSalePrice) for *all items combined*
  // and then split it back among items proportionally to their MRP fraction.
  //
  //  netAfterDiscounts = ( (basePrice - ADDITIONAL_DISCOUNT) * (1 - PICAPOOL_DISCOUNT_RATE) )

  const totalAfterDiscounts = (basePrice - ADDITIONAL_DISCOUNT) * (1 - PICAPOOL_DISCOUNT_RATE);

  // (e) Distribute final discounted amount across items proportionally
  //     salePrice_i = totalAfterDiscounts * (itemMRP / basePrice)
  let sumSalePrice = 0.0;

  orderItems = orderItems.map((item) => {
    // fraction for this item
    const fraction = item.mrp / basePrice;
    const salePrice = totalAfterDiscounts * fraction;

    sumSalePrice += salePrice;

    return {
      pID: item.pID,
      name: item.name,
      price: salePrice,      // The discounted price for WhatsApp
      image: item.image,
      mrp: item.mrp          // Keep MRP if you want to store it, optional
    };
  });

  // (f) Calculate tax and final price
  // As described: finalPicapoolPrice = sumSalePrice * 1.05 + DELIVERY_FEE
  // Where 1.05 means 5% tax on sumSalePrice
  const taxAmount = sumSalePrice * TAX_RATE;
  const finalPicapoolPrice = sumSalePrice + taxAmount + DELIVERY_FEE;

  console.log("[extractOrderDetails] sumSalePrice (total discounted) =", sumSalePrice);
  console.log("[extractOrderDetails] taxAmount (5%)               =", taxAmount);
  console.log("[extractOrderDetails] delivery                    =", DELIVERY_FEE);
  console.log("[extractOrderDetails] finalPicapoolPrice         =", finalPicapoolPrice);

  // Return everything needed
  return {
    orderItems,
    basePrice,
    sumSalePrice,          // sum of sale price of all items
    taxAmount,
    finalPicapoolPrice
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
