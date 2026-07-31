const mongoose = require("mongoose");

const drinkSchema = new mongoose.Schema({
    drinkName: String,
    drinkPrice: Number,
    drinkImg: String,
    toppings: [String]
});

const drinkToppingSchema = new mongoose.Schema({
    toppingNames: String,
    toppingPrice: Number
});

const drinkBillSchema = new mongoose.Schema({
    detail: [{
        staff: String,
        drinkImg: String,
        drink: String,
        toppings: String,
        drinkPrice: Number,
        status: Boolean
    }],
    billTotal: Number,
    billStatus: Boolean
}, { timestamps: true });

const drinkOweList = new mongoose.Schema({
    staffID: String,
    bank: Number
});

const Drink = mongoose.model("Drink", drinkSchema);
const DrinkToppings = mongoose.model("DrinkToppings", drinkToppingSchema);
const DrinkBill = mongoose.model("DrinkBill", drinkBillSchema);
const DrinkOweList = mongoose.model("DrinkOwelist", drinkOweList);

module.exports = {
    Drink,
    DrinkToppings,
    DrinkBill,
    DrinkOweList,
    drinkSchema,
    drinkToppingSchema,
    drinkBillSchema,
    drinkOweList
};
