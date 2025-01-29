// src/orderProcessor.js

const priceData = require('./priceData.json');

const TAX_RATE = 0.05;  // 5% tax
const PACKING_FEE = 20; // ₹20 packing fee
const PICA_POOL_DISCOUNT = 0.10; // 10% per pizza

function extractOrderDetails(message) {
    const lines = message.split("\n");
    let orderItems = [];
    let totalDominosPrice = 0;

    lines.forEach(line => {
        const match = line.match(/\(P_ID:\s*(\d+)\).*₹(\d+)/);
        if (match) {
            const pID = match[1];
            const price = parseFloat(match[2]);

            if (priceData[pID]) {
                const mrp = priceData[pID];
                totalDominosPrice += mrp;
                orderItems.push({ pID, mrp, price });
            }
        }
    });

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
