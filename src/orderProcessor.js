// src/orderProcessor.js

const priceData = require('./priceData.json');

const TAX_RATE = 0.05;  // 5% tax
const PACKING_FEE = 20; // ₹20 packing fee
const PICA_POOL_DISCOUNT = 0.10; // 10% per pizza

function extractOrderDetails(message) {
    let orderItems = [];
    let totalDominosPrice = 0;
    let baseprice = 0;

    console.log("=== extractOrderDetails: Incoming message ===");
    console.log(message);

    // Regular expression to find P_ID values
    const regex = /\(P_ID:\s*(\d+)\)/g;
    let match;

    while ((match = regex.exec(message)) !== null) {
        const pID = match[1];
        console.log("Found P_ID:", pID);

        if (priceData[pID]) {
            const mrp = priceData[pID];  // Get original MRP from DB
            console.log(`Price for P_ID ${pID}: ₹${mrp}`);
            totalDominosPrice += mrp;
            orderItems.push({ pID, mrp });
        } else {
            console.log(`Warning: Price data not found for P_ID ${pID}`);
        }
    }
    baseprice = totalDominosPrice;
    console.log("Base total before adjustments (MRP sum):", baseprice);

    // Apply adjustments: subtract extra discount, add tax, then add packing fee.
    totalDominosPrice = (totalDominosPrice - 60) * 1.05 + 20;
    console.log("Adjusted totalDominosPrice (after discount, tax, and packing fee):", totalDominosPrice);
    console.log("Order items array:", orderItems);

    return { orderItems, totalDominosPrice, baseprice };
}

function calculateFinalPrice(orderItems, extraDiscount = 60) {
    let picapoolTotal = 0;

    console.log("=== calculateFinalPrice: Processing each order item ===");
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

