// orderProcessor.js

const fetch = require('node-fetch');  // For Node 18 and below; Node 18+ has global fetch.
const Papa = require('papaparse');

// Your published Google Sheets CSV URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZSZaOjPBrejN1HsXWEGVnlWHei8G94s-NShyn7KcMXGF-gRXqQYIyU6i5eK1BF00u8SMnfZ2Vptyh/pub?output=csv';

// Constants for discount and fees
const ADDITIONAL_DISCOUNT = process.env.DOM_ADDITIONAL_DISCOUNT || 50;    // Subtracted once from total MRP sum
const PICAPOOL_DISCOUNT_RATE = 0.1; // 10% discount
const TAX_RATE = 0.05;             // 5% tax
const DELIVERY_FEE = process.env.DOM_DELIVERY_FEE || 20;           // Flat delivery cost

/**
 * 1) Fetch & parse CSV from Google Sheets, returning a mapping like { '57': 299, '58': 259, ... }.
 */
async function fetchPriceData(startRow, endRow) {
  console.log('--- [fetchPriceData] Fetching CSV...');

  const response = await fetch(SHEET_CSV_URL);
  const csvText = await response.text();

  console.log('--- [fetchPriceData] Parsing CSV with Papa...');
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  // Instead of logging the entire parsed array, just confirm its length:
  console.log('--- [fetchPriceData] Total rows:', parsed.data.length);

  // We only want rows from startRow...endRow:
  console.log(`--- [fetchPriceData] Slicing from index ${startRow} to ${endRow}`);
  const rowsToFetch = parsed.data.slice(startRow, endRow);

  // Optional: log the resulting slice if needed, or keep it minimal
  // console.log('--- [fetchPriceData] rowsToFetch:', rowsToFetch);

  const priceMap = {};
  rowsToFetch.forEach((row, index) => {

    console.log(`--- [fetchPriceData] Row index in slice [${index}] =>`, row);
    // Grab the relevant columns
    const productId = row['Product'];
    const originalPrice = row['Price (Original)'];
    const discountedPrice = row['Price (Discounted)'] || 0;
    const productName = row['Name'] || "";
    const imageUrl = row['Image URL'] || "";

    // Only store valid rows
    if (productId && originalPrice) {
      priceMap[productId] = {
        price: originalPrice,
        discountPrice: discountedPrice,
        name: productName,
        image: imageUrl
      };
    }
  });

  //console.log('--- [fetchPriceData] Built priceMap:', priceMap);
  return priceMap;
}

  

/**
 * 2) Extract P_IDs from the user's message, sum MRP from the Google Sheets data,
 *    and apply discount/tax/packing fee.
 */

/*
/////Old One ///////////////
async function extractOrderDetails(message) {
  console.log("=== [extractOrderDetails] Incoming message ===");
  console.log(message);

  // (A) Find the first P_ID
  const regex = /\(P_ID:\s*(\d+)\)/g;
  let match = regex.exec(message);  // use `let` if reassigning
  console.log("--- [extractOrderDetails] Regex match =>", match);

  let firstPID = null;
  if (match) {
    firstPID = parseInt(match[1], 10);
  }
  console.log("--- [extractOrderDetails] firstPID =>", firstPID);

  // (B) Decide the slice for the CSV
  let startRow = 0;
  let endRow = 0;
  if (firstPID >= 101 && firstPID < 184) {
    startRow = 2 - 2;   // or the correct index for that group
    endRow = 92 - 1;    // or the correct end for that group
    console.log(` DOMINOSS \n\n\n\n\n\n\ DOMINOS \n\n\n\n\n\n\ DOMINOS \n\n\n\n\n Detected range for 101 <= P_ID < 184 => slice(${startRow}, ${endRow})`);
  } else if (firstPID >= 601 && firstPID < 691) {
    // You see from the logs that P_ID=68 is at index 11, so let's include row 11
    startRow = 602 - 2;
    endRow = 691 -1 ;
    console.log(` KINGS \n\n\n\n\n\n\ KINGS \n\n\n\n\n\n\ KINGS \n\n\n\n\n Detected range for 67 <= P_ID < 79 => slice(${startRow}, ${endRow})`);
  } else {
    console.log("No specific range for this P_ID, skipping...");
    return;
  }

  // (C) Fetch the partial data
  const priceData = await fetchPriceData(startRow, endRow);
  //console.log("--- [extractOrderDetails] priceData fetched =>", priceData);

    // (d) Prepare for capturing details
    let orderItems = [];
    let basePrice = 0;
    // Collect each product's MRP
    let productMRPs = []; // just store the numerical MRP for each found P_ID

    let pID = match[1];
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
    }


  console.log("--- [extractOrderDetails] Searching for '(P_ID: XXX)' patterns...");



  while ((match = regex.exec(message)) !== null) {
     pID = match[1];
    if (priceData[pID]) {
       itemData = priceData[pID];
       numericMRP = itemData.price; // MRP from the sheet
       itemName = itemData.name;    // e.g. "Farmhouse (Regular)"
       itemImage = itemData.image;  // Full image link

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

  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);
  console.log(` -> Found P_ID ${pID}:`);


  // (d) Now apply Additional discount of ₹60, then Picapool discount of 10%
  // We'll compute the final net total (sumSalePrice) for *all items combined*
  // and then split it back among items proportionally to their MRP fraction.
  //
  //  netAfterDiscounts = ( (basePrice - ADDITIONAL_DISCOUNT) * (1 - PICAPOOL_DISCOUNT_RATE) )
  let totalAfterDiscounts=0;

  if(pID<500){
  totalAfterDiscounts = (basePrice - ADDITIONAL_DISCOUNT) * (1 - PICAPOOL_DISCOUNT_RATE);
  }
  if(pID>500)
  {totalAfterDiscounts=basePrice;
    
  }
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
  const finalPicapoolPrice = (sumSalePrice + DELIVERY_FEE) + (basePrice * TAX_RATE);

  console.log("[extractOrderDetails] totalAfterDiscounts  =", totalAfterDiscounts);
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
  */

async function extractOrderDetails(message) {
  console.log("=== [extractOrderDetails] Incoming message ===");
  console.log(message);

  // (A) Find the first P_ID
  const regex = /\(P_ID:\s*(\d+)\)/g;
  let match = regex.exec(message);  // use `let` if reassigning
  console.log("--- [extractOrderDetails] Regex match =>", match);

  let firstPID = null;
  if (match) {
    firstPID = parseInt(match[1], 10);
  }
  console.log("--- [extractOrderDetails] firstPID =>", firstPID);

  // (B) Decide the slice for the CSV
  let startRow = 0;
  let endRow = 0;
  if (firstPID >= 101 && firstPID < 184) {
    startRow = 2 - 2;   // or the correct index for that group
    endRow = 92 - 1;    // or the correct end for that group
    console.log(` DOMINOSS \n\n\n\n\n\n\ DOMINOS \n\n\n\n\n\n\ DOMINOS \n\n\n\n\n Detected range for 101 <= P_ID < 184 => slice(${startRow}, ${endRow})`);
  } else if (firstPID >= 601 && firstPID < 691) {
    startRow = 602 - 2;
    endRow = 691 - 1;
    console.log(` KINGS \n\n\n\n\n\n\ KINGS \n\n\n\n\n\n\ KINGS \n\n\n\n\n Detected range for 67 <= P_ID < 79 => slice(${startRow}, ${endRow})`);
  } else {
    console.log("No specific range for this P_ID, skipping...");
    return;
  }

  // (C) Fetch the partial data
  const priceData = await fetchPriceData(startRow, endRow);

  // (d) Prepare for capturing details
  let orderItems = [];
  let basePrice = 0;
  let quantityMap = {};  // This will track quantities for each P_ID
  let productMRPs = []; // just store the numerical MRP for each found P_ID

  // (d) Searching for (P_ID: XXX) patterns...
  console.log("--- [extractOrderDetails] Searching for '(P_ID: XXX)' patterns...");

  // (1) Handle the first item separately
  if (match) {
    let pID = match[1];
    if (priceData[pID]) {
      let itemData = priceData[pID];
      let numericMRP = itemData.price; // MRP from the sheet
      let itemName = itemData.name;    // e.g. "Farmhouse (Regular)"
      let itemImage = itemData.image;  // Full image link

      console.log(` -> Found P_ID ${pID}: ${itemName}, MRP = ${numericMRP}`);

      // Increment quantity for this P_ID
      if (quantityMap[pID]) {
        quantityMap[pID].quantity += 1; // Increment quantity
      } else {
        quantityMap[pID] = {
          name: itemName,
          price: numericMRP,
          image: itemImage,
          quantity: 1  // Start with quantity 1 for the first instance
        };
      }
    } else {
      console.warn(`   Warning: No data for P_ID ${pID}`);
    }
  }

  // (2) Continue with the rest of the items
  while ((match = regex.exec(message)) !== null) {
    let pID = match[1];
    if (priceData[pID]) {
      let itemData = priceData[pID];
      let numericMRP = itemData.price; // MRP from the sheet
      let itemName = itemData.name;    // e.g. "Farmhouse (Regular)"
      let itemImage = itemData.image;  // Full image link

      console.log(` -> Found P_ID ${pID}: ${itemName}, MRP = ${numericMRP}`);

      // Increment quantity for this P_ID
      if (quantityMap[pID]) {
        quantityMap[pID].quantity += 1; // Increment quantity
      } else {
        quantityMap[pID] = {
          name: itemName,
          price: numericMRP,
          image: itemImage,
          quantity: 1  // Start with quantity 1 for the first instance
        };
      }
    } else {
      console.warn(`   Warning: No data for P_ID ${pID}`);
    }
  }

  // Now, prepare the orderItems array with combined quantities
  for (let pID in quantityMap) {
    let item = quantityMap[pID];
    let totalPrice = item.price * item.quantity;
    let updatedName = `${item.name} (Quantity x${item.quantity})`;

    orderItems.push({
      pID,
      name: updatedName,
      mrp: totalPrice,  // Total price for this grouped item
      image: item.image,
    });

    basePrice += totalPrice;
    productMRPs.push(totalPrice); // Add to the productMRPs array
  }

  console.log("[extractOrderDetails] Base total (MRP sum) =", basePrice);

  // (d) Now apply Additional discount of ₹60, then Picapool discount of 10%
  let totalAfterDiscounts = 0;

  if (firstPID < 500) {
    totalAfterDiscounts = (basePrice - ADDITIONAL_DISCOUNT) * (1 - PICAPOOL_DISCOUNT_RATE);
  } else {
    totalAfterDiscounts = basePrice;
  }

  // (e) Distribute final discounted amount across items proportionally
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
  const taxAmount = sumSalePrice * TAX_RATE;
  const finalPicapoolPrice = (sumSalePrice + DELIVERY_FEE) + (basePrice * TAX_RATE);

  console.log("[extractOrderDetails] totalAfterDiscounts  =", totalAfterDiscounts);
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
