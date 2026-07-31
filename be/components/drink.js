const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
    Drink,
    DrinkToppings,
    DrinkBill,
    DrinkOweList
} = require("../models/drink");

const { authenticateAdmin, checkPermission } = require("../middlewares/auth"); // bạn có thể dùng nếu cần phân quyền

const drinkStorage = multer.diskStorage({
    destination: "./upload/drinks",
    filename: function (req, file, cb) {
        const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ drinkStorage });

router.post("/upload", upload.single('drinkImg'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const imgUrl = `${process.env.ADDRESS}/images/${req.file.filename}`;
    res.json({ imgUrl });
});

router.delete("/upload/:filename", (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, "upload/drinks", filename);

    fs.unlink(filepath, (err) => {
        if (err) {
            return res.status(404).json({ error: "File not found or could not be deleted" });
        }
        res.json({ message: "File deleted" });
    });
});

router.post("/drink", async (req, res) => {
    try {
        const drink = new Drink(req.body);
        await drink.save();
        res.json(drink);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put("/drink/:id", async (req, res) => {
    try {
        const drink = await Drink.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(drink);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete("/drink/:id", async (req, res) => {
    try {
        await Drink.findByIdAndDelete(req.params.id);
        res.json({ message: "Drink deleted" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/topping", async (req, res) => {
    try {
        const topping = new DrinkToppings(req.body);
        await topping.save();
        res.json(topping);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put("/topping/:id", async (req, res) => {
    try {
        const topping = await DrinkToppings.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(topping);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Xoá topping
router.delete("/topping/:id", async (req, res) => {
    try {
        await DrinkToppings.findByIdAndDelete(req.params.id);
        res.json({ message: "Topping deleted" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/bill", async (req, res) => {
    try {
        const bill = new DrinkBill(req.body);
        await bill.save();
        res.json(bill);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put("/bill/:id", async (req, res) => {
    try {
        const bill = await DrinkBill.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(bill);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete("/bill/:id", async (req, res) => {
    try {
        await DrinkBill.findByIdAndDelete(req.params.id);
        res.json({ message: "Bill deleted" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch("/bill/:billId/item/:index/status", async (req, res) => {
    try {
        const { status } = req.body;
        const bill = await DrinkBill.findById(req.params.billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        bill.detail[req.params.index].status = status;
        await bill.save();
        res.json(bill);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch("/bill/:billId/status", async (req, res) => {
    try {
        const { billStatus } = req.body;
        const bill = await DrinkBill.findByIdAndUpdate(
            req.params.billId,
            { billStatus },
            { new: true }
        );
        res.json(bill);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
