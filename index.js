require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");
const connectDB = require("./db");
const Country = require("./models/Country");
const User = require("./models/User");

// =====================================
// CONNECT DATABASE
// =====================================
connectDB();

// =====================================
// EXPRESS SERVER
// =====================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <title>OTP Bot</title>
                <style>
                    body{
                        background:#0f172a;
                        color:white;
                        display:flex;
                        justify-content:center;
                        align-items:center;
                        height:100vh;
                        margin:0;
                        flex-direction:column;
                        font-family:Arial;
                    }
                    h1{ color:#22c55e; font-size:55px; }
                    p{ color:#cbd5e1; font-size:22px; }
                </style>
            </head>
            <body>
                <h1>✅ BOT RUNNING</h1>
                <p>Telegram OTP Bot Active</p>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log("Web Server Running");
});

// =====================================
// ADMIN IDS
// =====================================
const ADMIN_IDS = [5948588400];

// =====================================
// TELEGRAM BOT
// =====================================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// =====================================
// API CONFIG
// =====================================
const MAUTH_API = process.env.MAUTH_API;
const HEADERS = { "mauthapi": MAUTH_API };
const GET_NUMBER_API = "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/getnum";
const OTP_API = "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/success-otp";

// =====================================
// TEMP ADMIN STATE
// =====================================
const adminState = {};

// =====================================
// START COMMAND
// =====================================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "🤖 OTP BOT READY", {
        reply_markup: {
            inline_keyboard: [[{ text: "🌍 Get Number", callback_data: "get_number" }]]
        }
    });
});

// =====================================
// ADMIN PANEL
// =====================================
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    if (!ADMIN_IDS.includes(chatId)) return;

    bot.sendMessage(chatId, "⚙️ ADMIN PANEL", {
        reply_markup: {
            keyboard: [
                ["➕ Add Country"],
                ["➖ Remove Country"],
                ["📋 Country List"]
            ],
            resize_keyboard: true
        }
    });
});

// =====================================
// MESSAGE HANDLER
// =====================================
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // ADD COUNTRY
    if (text === "➕ Add Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "country_name" };
        return bot.sendMessage(chatId, "Send country name");
    }

    // COUNTRY NAME
    if (adminState[chatId] && adminState[chatId].step === "country_name") {
        adminState[chatId].countryName = text;
        adminState[chatId].step = "country_range";
        return bot.sendMessage(chatId, "Send range\n\nExample:\n228983");
    }

    // COUNTRY RANGE
    if (adminState[chatId] && adminState[chatId].step === "country_range") {
        await Country.create({
            name: adminState[chatId].countryName,
            range: text
        });
        delete adminState[chatId];
        return bot.sendMessage(chatId, "✅ Country Added");
    }

    // REMOVE COUNTRY
    if (text === "➖ Remove Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "remove_country" };
        return bot.sendMessage(chatId, "Send exact country name");
    }

    if (adminState[chatId] && adminState[chatId].step === "remove_country") {
        await Country.deleteOne({ name: text });
        delete adminState[chatId];
        return bot.sendMessage(chatId, "✅ Country Removed");
    }

    // COUNTRY LIST
    if (text === "📋 Country List" && ADMIN_IDS.includes(chatId)) {
        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "No countries");
        }

        let result = "🌍 COUNTRY LIST\n\n";
        countries.forEach((c, i) => {
            result += `${i + 1}. ${c.name}\nRange: ${c.range}\n\n`;
        });
        return bot.sendMessage(chatId, result);
    }
});

// =====================================
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// =====================================
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    bot.answerCallbackQuery(query.id).catch(() => {});

    // GET NUMBER -> SHOW COUNTRY LIST
    if (data === "get_number") {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        const countries = await Country.find();

        if (!countries.length) {
            return bot.sendMessage(chatId, "❌ No country available");
        }

        return bot.sendMessage(chatId, "🌍 Select a country ⬇️", {
            reply_markup: {
                inline_keyboard: countries.map(c => [{ text: c.name, callback_data: `country_${c._id}` }])
            }
        });
    }

    // COUNTRY SELECTED -> GET 3 NUMBERS
    if (data.startsWith("country_")) {
        const countryId = data.replace("country_", "");
        const selectedCountry = await Country.findById(countryId);

        if (!selectedCountry) {
            return bot.sendMessage(chatId, "❌ Country not found");
        }

        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return getNumbers(chatId, selectedCountry);
    }

    // CHANGE NUMBER -> GET 3 NEW NUMBERS
    if (data === "change_number") {
        const user = await User.findOne({ chatId });
        if (!user) {
            return bot.sendMessage(chatId, "❌ No active number");
        }

        const country = await Country.findOne({ name: user.country });
        if (!country) {
            return bot.sendMessage(chatId, "❌ Country not found");
        }

        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return getNumbers(chatId, country);
    }
});

// =====================================
// GET NUMBERS ENGINE
// =====================================
async function getNumbers(chatId, country) {
    try {
        const fetched = [];

        for (let i = 0; i < 3; i++) {
            try {
                const response = await axios.post(GET_NUMBER_API, {
                    rid: country.range,
                }, {
                    headers: HEADERS,
                    timeout: 15000
                });

                const resData = response.data;
                if (!resData || !resData.meta || resData.meta.code !== 200 || !resData.data || !resData.data.full_number) {
                    continue;
                }

                const numData = resData.data;
                const numberId = resData.rid || numData.no_plus_number || numData.full_number;

                fetched.push({
                    number: numData.full_number,
                    number_id: numberId,
                    operator: numData.operator,
                    countryName: numData.country || country.name,
                    otpReceived: false
                });

                console.log("📥 FETCHED NUMBER:", numData.full_number, "| id:", numberId);
            } catch (e) {
                console.log("GET NUMBER ERROR:", e.message);
            }
        }

        if (!fetched.length) {
            return bot.sendMessage(chatId, "❌ Failed to get number");
        }

        await User.findOneAndUpdate(
            { chatId },
            {
                chatId,
                country: fetched[0].countryName,
                numbers: fetched
            },
            { upsert: true }
        );

        let message = `📱 NUMBERS\n\n`;
        fetched.forEach((n, i) => {
            message += `${i + 1}. \`${n.number}\`\n   🌍 ${n.countryName} | 📡 ${n.operator}\n\n`;
        });
        message += `Tap a number to copy`;

        await bot.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🌍 Get Number", callback_data: "get_number" }],
                    [{ text: "🔄 Change Number", callback_data: "change_number" }]
                ]
            }
        });

        startOtpChecker(chatId, fetched.map(n => n.number_id));
    } catch (e) {
        console.log(e.message);
        bot.sendMessage(chatId, "❌ API Error");
    }
}

// =====================================
// SMART MATCHING OTP CHECKER
// =====================================
function startOtpChecker(chatId, numberIds) {
    console.log("🔄 OTP CHECKER STARTED for", chatId, "numbers:", numberIds);

    const interval = setInterval(async () => {
        try {
            const user = await User.findOne({ chatId });

            if (!user || !Array.isArray(user.numbers) || !user.numbers.length) {
                console.log("⏹ STOP: no user/numbers for", chatId);
                clearInterval(interval);
                return;
            }

            const pending = user.numbers.filter(n => numberIds.includes(n.number_id) && !n.otpReceived);
            const stillTracked = user.numbers.some(n => numberIds.includes(n.number_id));

            if (!stillTracked || !pending.length) {
                console.log("⏹ STOP: batch finished or overridden for", chatId);
                clearInterval(interval);
                return;
            }

            const response = await axios.get(OTP_API, { headers: HEADERS, timeout: 15000 });
            const resData = response.data;

            if (!resData || !resData.meta || resData.meta.code !== 200 || !resData.data || !Array.isArray(resData.data.otps) || resData.data.otps.length === 0) {
                return;
            }

            for (const n of pending) {
                const numberDigits = n.number.replace(/[^0-9]/g, "");

                const match = resData.data.otps.find(entry => {
                    if (!entry || !entry.number) return false;
                    const entryDigits = entry.number.replace(/[^0-9]/g, "");
                    
                    return (
                        entryDigits === numberDigits ||
                        entryDigits.endsWith(numberDigits) ||
                        numberDigits.endsWith(entryDigits)
                    );
                });

                if (!match) continue;

                console.log("✅ MATCH FOUND for", n.number, "->", JSON.stringify(match));

                // Instantly update DB status to avoid race conditions/duplicate messages
                await User.updateOne(
                    { chatId },
                    { $set: { "numbers.$[elem].otpReceived": true } },
                    { arrayFilters: [{ "elem.number_id": n.number_id }] }
                );

                const messageText = match.message || match.text || match.sms || "";
                
                // Safe extraction pattern for standard split formats (e.g. "798 231" or "798231")
                const splitOtpMatch = messageText.match(/\b\d{3}\s\d{3}\b/);
                let otpCode = "";
                
                if (splitOtpMatch) {
                    otpCode = splitOtpMatch[0].replace(/\s/g, ""); // "798 231" -> "798231"
                } else {
                    const fallbackDigits = messageText.replace(/\D/g, "");
                    otpCode = match.otp || fallbackDigits.slice(0, 6);
                }

                try {
                    await bot.sendMessage(
                        chatId,
                        `✅ **OTP RECEIVED**\n\n📱 **Number:**\n\`${n.number}\`\n\n🔐 **OTP:** \`${otpCode}\`\n\n📩 **Message:**\n\`${messageText}\``,
                        { parse_mode: "Markdown" }
                    );
                    console.log("📤 OTP forwarded to", chatId);
                } catch (sendErr) {
                    console.log("🚫 sendMessage FAILED:", sendErr.message);
                }
            }

            // Post-pass verification context loop check
            const refreshedUser = await User.findOne({ chatId });
            const stillPending = refreshedUser && refreshedUser.numbers.some(n => numberIds.includes(n.number_id) && !n.otpReceived);

            if (!stillPending) {
                console.log("⏹ STOP: all numbers verified complete for", chatId);
                clearInterval(interval);
            }

        } catch (e) {
            console.log("OTP ERROR:", e.message);
        }
    }, 2000);
}

// =====================================
// ERROR HANDLER
// =====================================
bot.on("polling_error", console.log);
console.log("BOT RUNNING...");
                    
