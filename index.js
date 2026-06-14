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
// EXPRESS SERVER (Keep-Alive Dashboard)
// =====================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <title>OTP Bot</title>
                <style>
                    body {
                        background: #0f172a;
                        color: white;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        flex-direction: column;
                        font-family: Arial, sans-serif;
                    }
                    h1 { color: #22c55e; font-size: 55px; margin-bottom: 10px; }
                    p { color: #cbd5e1; font-size: 22px; margin-top: 0; }
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
    console.log(`🚀 Web Server Running on port ${PORT}`);
});

// =====================================
// CONFIG & ADMINS
// =====================================
const ADMIN_IDS = [5948588400]; // Add authorized Telegram Chat IDs here
const MAUTH_API = process.env.MAUTH_API;
const HEADERS = { "mauthapi": MAUTH_API };
const GET_NUMBER_API = "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/getnum";
const OTP_API = "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/success-otp";

const adminState = {};

// =====================================
// TELEGRAM BOT INITIALIZATION
// =====================================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// =====================================
// START COMMAND
// =====================================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "🤖 **OTP BOT READY**", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [[{ text: "🌍 Get Number", callback_data: "get_number" }]]
        }
    });
});

// =====================================
// ADMIN PANEL Command
// =====================================
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    if (!ADMIN_IDS.includes(chatId)) return;

    bot.sendMessage(chatId, "⚙️ **ADMIN PANEL**", {
        parse_mode: "Markdown",
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
// ADMIN TEXT MESSAGE PROCESSING
// =====================================
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // 1. Trigger Add Country State
    if (text === "➕ Add Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "country_name" };
        return bot.sendMessage(chatId, "Send country name:");
    }

    // 2. Process Country Name Input
    if (adminState[chatId] && adminState[chatId].step === "country_name") {
        adminState[chatId].countryName = text;
        adminState[chatId].step = "country_range";
        return bot.sendMessage(chatId, "Send range\n\nExample:\n`228983`", { parse_mode: "Markdown" });
    }

    // 3. Process Range Input & Save
    if (adminState[chatId] && adminState[chatId].step === "country_range") {
        try {
            await Country.create({
                name: adminState[chatId].countryName,
                range: text
            });
            delete adminState[chatId];
            return bot.sendMessage(chatId, "✅ Country Added Successfully!");
        } catch (err) {
            delete adminState[chatId];
            return bot.sendMessage(chatId, "❌ Failed to add country (Might already exist).");
        }
    }

    // 4. Trigger Remove Country State
    if (text === "➖ Remove Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "remove_country" };
        return bot.sendMessage(chatId, "Send exact country name to remove:");
    }

    // 5. Process Country Removal
    if (adminState[chatId] && adminState[chatId].step === "remove_country") {
        await Country.deleteOne({ name: text });
        delete adminState[chatId];
        return bot.sendMessage(chatId, "✅ Country Removed.");
    }

    // 6. View Country List
    if (text === "📋 Country List" && ADMIN_IDS.includes(chatId)) {
        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "No countries found in database.");
        }

        let result = "🌍 **COUNTRY LIST**\n\n";
        countries.forEach((c, i) => {
            result += `${i + 1}. **${c.name}**\nRange: \`${c.range}\`\n\n`;
        });
        return bot.sendMessage(chatId, result, { parse_mode: "Markdown" });
    }
});

// =====================================
// CALLBACK BUTTON HANDLERS
// =====================================
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    bot.answerCallbackQuery(query.id).catch(() => {});

    // Action: List Countries for User Selection
    if (data === "get_number") {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "❌ No countries available at the moment.");
        }

        return bot.sendMessage(chatId, "🌍 **Select a country below:**", {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: countries.map(c => [
                    { text: c.name, callback_data: `country_${c._id}` }
                ])
            }
        });
    }

    // Action: Country Selected -> Generate Numbers
    if (data.startsWith("country_")) {
        const countryId = data.replace("country_", "");
        const selectedCountry = await Country.findById(countryId);

        if (!selectedCountry) {
            return bot.sendMessage(chatId, "❌ Country selected no longer exists.");
        }

        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return getNumbers(chatId, selectedCountry);
    }

    // Action: Cycle Current Numbers out for fresh alternatives
    if (data === "change_number") {
        const user = await User.findOne({ chatId });
        if (!user) {
            return bot.sendMessage(chatId, "❌ No active session found.");
        }

        const country = await Country.findOne({ name: user.country });
        if (!country) {
            return bot.sendMessage(chatId, "❌ Configuration error for country.");
        }

        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        return getNumbers(chatId, country);
    }
});

// =====================================
// NUMBER PROCUREMENT DISPATCHER
// =====================================
async function getNumbers(chatId, country) {
    try {
        const fetched = [];

        // Attempt up to 3 individual HTTP requests to pool numbers
        for (let i = 0; i < 3; i++) {
            try {
                const response = await axios.post(GET_NUMBER_API, {
                    rid: country.range
                }, {
                    headers: HEADERS,
                    timeout: 15000
                });

                const resData = response.data;
                if (!resData || resData.meta?.code !== 200 || !resData.data?.full_number) {
                    continue;
                }

                const numData = resData.data;
                const numberId = resData.rid || numData.no_plus_number || numData.full_number;

                fetched.push({
                    number: numData.full_number,
                    number_id: numberId,
                    operator: numData.operator || "Unknown",
                    countryName: numData.country || country.name,
                    otpReceived: false
                });

                console.log(`📥 FETCHED NUMBER: ${numData.full_number} | ID: ${numberId}`);
            } catch (e) {
                console.log("GET NUMBER STEP ERROR:", e.message);
            }
        }

        if (!fetched.length) {
            return bot.sendMessage(chatId, "❌ Failed to secure any virtual numbers. Try again later.");
        }

        // Cache parameters to database state
        await User.findOneAndUpdate(
            { chatId },
            { chatId, country: fetched[0].countryName, numbers: fetched },
            { upsert: true }
        );

        // Format and distribute interface metrics to user
        let message = `📱 **YOUR VIRTUAL NUMBERS**\n\n`;
        fetched.forEach((n, i) => {
            message += `${i + 1}. \`${n.number}\`\n   🌍 ${n.countryName} | 📡 ${n.operator}\n\n`;
        });
        message += `_Tap any number to copy easily._`;

        await bot.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🌍 Get Different Country", callback_data: "get_number" }],
                    [{ text: "🔄 Refresh All Numbers", callback_data: "change_number" }]
                ]
            }
        });

        // Initialize active live listener context matching this specific payload batch
        startOtpChecker(chatId, fetched.map(n => n.number_id));

    } catch (e) {
        console.log("CRITICAL PROCUREMENT ERROR:", e.message);
        bot.sendMessage(chatId, "❌ External API Error occurred.");
    }
}

// =====================================
// HIGH-FREQUENCY OTP MATCHING ENGINE
// =====================================
function startOtpChecker(chatId, numberIds) {
    console.log(`🔄 OTP CHECKER ACTIVE [Chat: ${chatId}] Targeting IDs:`, numberIds);

    const interval = setInterval(async () => {
        try {
            const user = await User.findOne({ chatId });

            // Safety break: terminate process if user wipes data parameters or logs out
            if (!user || !Array.isArray(user.numbers) || !user.numbers.length) {
                console.log(`⏹ STOPPED LISTENER: Clear dataset structure missing for chat ${chatId}`);
                clearInterval(interval);
                return;
            }

            // Isolate items within this specific context block that still lack confirmation matches
            const pending = user.numbers.filter(n => numberIds.includes(n.number_id) && !n.otpReceived);
            const stillTracked = user.numbers.some(n => numberIds.includes(n.number_id));

            if (!stillTracked || !pending.length) {
                console.log(`⏹ STOPPED LISTENER: Target batch finished or renewed for chat ${chatId}`);
                clearInterval(interval);
                return;
            }

            // Sync structural information feed from live server array API
            const response = await axios.get(OTP_API, { headers: HEADERS, timeout: 15000 });
            const resData = response.data;

            if (!resData || resData.meta?.code !== 200 || !Array.isArray(resData.data?.otps) || resData.data.otps.length === 0) {
                return; // Silence loops running empty structures
            }

            // Cross-evaluate data elements
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

                console.log(`✅ MATCH FOUND -> Consolidating incoming message for ${n.number}`);

                // Instantly lock database element values to avoid duplicate Telegram message dispatching 
                await User.updateOne(
                    { chatId },
                    { $set: { "numbers.$[elem].otpReceived": true } },
                    { arrayFilters: [{ "elem.number_id": n.number_id }] }
                );

                // Isolate structural values safely
                const messageText = match.message || match.text || match.sms || "Empty Content";
                const cleanedDigits = messageText.replace(/\D/g, "");
                const otpCode = match.otp || cleanedDigits.slice(0, 6);

                try {
                    await bot.sendMessage(
                        chatId,
                        `✅ **OTP RECEIVED**\n\n📱 **Number:**\n\`${n.number}\`\n\n🔐 **OTP Code:** \`${otpCode}\`\n\n📩 **Full Message:**\n\`${messageText}\``,
                        { parse_mode: "Markdown" }
                    );
                    console.log(`📤 Message delivered to Telegram Client: ${chatId}`);
                } catch (sendErr) {
                    console.log("🚫 Telegram transmission pipeline failed:", sendErr.message);
                }
            }

            // Post checking phase sweep: verify if additional targets remain active inside database space
            const refreshedUser = await User.findOne({ chatId });
            const stillPending = refreshedUser && refreshedUser.numbers.some(n => numberIds.includes(n.number_id) && !n.otpReceived);

            if (!stillPending) {
                console.log(`⏹ STOPPED LISTENER: Comprehensive verification completed for chat ${chatId}`);
                clearInterval(interval);
            }

        } catch (e) {
            console.log("SYSTEM INTERNAL SAMPLING ERROR:", e.message);
        }
    }, 2000);
}

// Global Hook to capture and silence unexpected runtime crash variations
bot.on("polling_error", (error) => console.log("🤖 Polling notice:", error.message));
console.log("🤖 OTP SYSTEM BOOT COMPLETED SUCCESSFUL.");
                    
