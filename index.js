require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");

const connectDB = require("./db");

const Country = require("./models/Country");
const User = require("./models/User");

// ===================== DB CONNECT =====================
connectDB();

// ===================== EXPRESS =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("✅ BOT RUNNING");
});

app.listen(PORT, () => {
    console.log("Web server running");
});

// ===================== BOT =====================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true
});

const API_KEY = process.env.API_KEY;

const HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
};

const ADMIN_IDS = process.env.ADMIN_IDS
    .split(",")
    .map(Number);

// ===================== ADMIN STATE =====================
const adminState = {};

// ===================== START =====================
bot.onText(/\/start/, async (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 OTP BOT", {
        reply_markup: {
            keyboard: [
                ["🌍 Get Number"],
                ["🔄 Change Number"]
            ],
            resize_keyboard: true
        }
    });
});

// ===================== ADMIN =====================
bot.onText(/\/admin/, (msg) => {
    if (!ADMIN_IDS.includes(msg.chat.id)) return;

    bot.sendMessage(msg.chat.id, "Admin Panel", {
        reply_markup: {
            keyboard: [
                ["➕ Add Country"],
                ["➖ Remove Country"],
                ["📋 List Country"]
            ],
            resize_keyboard: true
        }
    });
});

// ===================== MESSAGE =====================
bot.on("message", async (msg) => {

    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // ================= ADD COUNTRY =================
    if (text === "➕ Add Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "name" };
        return bot.sendMessage(chatId, "Send country name");
    }

    if (adminState[chatId]?.step === "name") {
        adminState[chatId].name = text;
        adminState[chatId].step = "range";
        return bot.sendMessage(chatId, "Send range (example: 228985XXX)");
    }

    if (adminState[chatId]?.step === "range") {
        await Country.create({
            name: adminState[chatId].name,
            range: text
        });

        delete adminState[chatId];

        return bot.sendMessage(chatId, "✅ Country saved in DB");
    }

    // ================= LIST COUNTRY =================
    if (text === "📋 List Country") {

        const list = await Country.find();

        if (!list.length)
            return bot.sendMessage(chatId, "No countries");

        let msgText = "🌍 Countries\n\n";

        list.forEach((c, i) => {
            msgText += `${i + 1}. ${c.name} - ${c.range}\n`;
        });

        return bot.sendMessage(chatId, msgText);
    }

    // ================= GET NUMBER =================
    if (text === "🌍 Get Number") {

        const list = await Country.find();

        if (!list.length)
            return bot.sendMessage(chatId, "No country");

        return bot.sendMessage(chatId, "Select country", {
            reply_markup: {
                keyboard: list.map(c => [c.name]),
                resize_keyboard: true
            }
        });
    }

    // ================= SELECT COUNTRY =================
    const country = await Country.findOne({ name: text });

    if (country) {
        return getNumber(chatId, country);
    }

    // ================= CHANGE NUMBER =================
    if (text === "🔄 Change Number") {

        const user = await User.findOne({ chatId });

        if (!user)
            return bot.sendMessage(chatId, "No active number");

        const c = await Country.findOne({ name: user.country });

        if (!c)
            return bot.sendMessage(chatId, "Country missing");

        return getNumber(chatId, c);
    }
});

// ===================== GET NUMBER =====================
async function getNumber(chatId, country) {

    try {

        const res = await axios.post(
            "http://63.141.255.227/api/v1/numbers/get",
            {
                range: country.range,
                format: "national"
            },
            { headers: HEADERS }
        );

        const data = res.data;

        if (!data.success)
            return bot.sendMessage(chatId, "Failed");

        await User.findOneAndUpdate(
            { chatId },
            {
                chatId,
                number: data.number,
                number_id: data.number_id,
                country: country.name,
                otpReceived: false
            },
            { upsert: true }
        );

        bot.sendMessage(chatId, `📱 ${data.number}`);

        startChecker(chatId, data.number_id);

    } catch (e) {
        bot.sendMessage(chatId, "API Error");
    }
}

// ===================== OTP CHECKER =====================
function startChecker(chatId, numberId) {

    const interval = setInterval(async () => {

        const user = await User.findOne({ chatId });

        if (!user || user.number_id !== numberId) {
            clearInterval(interval);
            return;
        }

        if (user.otpReceived) {
            clearInterval(interval);
            return;
        }

        try {

            const res = await axios.get(
                `http://63.141.255.227/api/v1/numbers/${numberId}/sms`,
                { headers: HEADERS }
            );

            const data = res.data;

            if (data.status === "pending") return;

            if (data.success && data.received) {

                await User.updateOne(
                    { chatId },
                    { otpReceived: true }
                );

                bot.sendMessage(
                    chatId,
                    `✅ OTP\n${data.otp}\n\n${data.message}`
                );

                clearInterval(interval);
            }

        } catch (e) {
            console.log("OTP ERROR", e.message);
        }

    }, 25000);
}

console.log("BOT RUNNING");
