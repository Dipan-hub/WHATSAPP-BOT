// src/orderProcessor.js

const priceData = require('./priceData.json');

const TAX_RATE = 0.05;  // 5% tax
const PACKING_FEE = 20; // ₹20 packing fee
const PICA_POOL_DISCOUNT = 0.10; // 10% per pizza

function extractOrderDetails(message) {
    let orderItems = [];
    let totalDominosPrice = 0;

    // Regular expression to find P_ID values
    const regex = /\(P_ID:\s*(\d+)\)/g;
    let match;

    while ((match = regex.exec(message)) !== null) {
        const pID = match[1];

        if (priceData[pID]) {
            const mrp = priceData[pID];  // Get original MRP from DB
            totalDominosPrice += mrp;
            orderItems.push({ pID, mrp });
        }
    }
    totalDominosPrice=(totalDominosPrice-60) * 1.05 +20;
    return { orderItems, totalDominosPrice };
}

function calculateFinalPrice(orderItems, extraDiscount = 60) {
    let picapoolTotal = 0;

    orderItems.forEach(item => {
        let discountedPrice = item.mrp * (1 - PICA_POOL_DISCOUNT);
        picapoolTotal += discountedPrice;
    });

    let tax = picapoolTotal * TAX_RATE;
    let finalPrice = picapoolTotal + tax + PACKING_FEE - extraDiscount;

    return {
        picapoolTotal: picapoolTotal.toFixed(2),
        tax: tax.toFixed(2),
        finalPrice: finalPrice.toFixed(2)
    };
}

module.exports = { extractOrderDetails, calculateFinalPrice };
