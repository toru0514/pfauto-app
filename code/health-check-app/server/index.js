// index.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/healthcheck", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ----------------- Healthチェックの定義 -----------------

const HealthSchema = new mongoose.Schema({
    name: String,
    condition: String,
    conditionReason: String,
    breakfast: String,
    task: String,
    ky: String,
    date: { type: Date, default: Date.now },
});

const Health = mongoose.model("Health", HealthSchema);

app.post("/api/health", async (req, res) => {
    try {
        const inputDate = req.body.date
            ? new Date(req.body.date)
            : new Date();

        const jstDate = new Date(Date.UTC(
            inputDate.getFullYear(),
            inputDate.getMonth(),
            inputDate.getDate()
        ));

        const filter = {
            name: req.body.name,
            date: jstDate
        };

        const update = {
            condition: req.body.condition,
            conditionReason: req.body.conditionReason || "",
            breakfast: req.body.breakfast,
            task: req.body.task,
            ky: req.body.ky,
        };

        const options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };

        const result = await Health.findOneAndUpdate(filter, update, options);

        res.status(200).json({ message: "保存または更新しました", data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "サーバーエラー" });
    }
});

app.get("/api/health", async (req, res) => {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month); // 1〜12

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // 翌月の1日

    const records = await Health.find({
        date: { $gte: startDate, $lt: endDate }
    });

    res.json(records);
});

// ----------------- 名前リスト管理の定義 -----------------

const NameSchema = new mongoose.Schema({
    name: String,
});

const Name = mongoose.model("Name", NameSchema);

app.get("/api/names", async (req, res) => {
    try {
        const names = await Name.find();
        res.json(names);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "取得エラー" });
    }
});

app.post("/api/names", async (req, res) => {
    try {
        const newName = new Name({ name: req.body.name });
        await newName.save();
        res.status(201).json({ message: "追加完了" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "追加失敗" });
    }
});

app.delete("/api/names/:id", async (req, res) => {
    try {
        await Name.findByIdAndDelete(req.params.id);
        res.json({ message: "削除完了" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "削除失敗" });
    }
});

// ----------------- サーバー起動 -----------------

app.listen(5000, () => console.log("🚀 APIサーバー起動: http://localhost:5000"));
