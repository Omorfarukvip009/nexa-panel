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
                    h1{
                        color:#22c55e;
                        font-size:55px;
                    }
                    p{
                        color:#cbd5e1;
                        font-size:22px;
                    }
                </style>
            </head>
            <body>
                <h1>✅ BOT RUNNING</h1>
                <p>Telegram OTP Bot (YesMS API) Active</p>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log("Web Server Running");
});

// =====================================
// CONFIGURATION (ADMIN & TARGET GROUP)
// =====================================
const ADMIN_IDS = [5948588400]; 

// ⚙️ CHOOSE YOUR TARGET GROUP/CHANNEL CONFIGURATION:
const REQUIRED_GROUP_ID = process.env.REQUIRED_GROUP_ID || -1003724610035; 
const GROUP_LINK = "https://t.me/+ROInVYWEN-czMjI1"; 

// =====================================
// TELEGRAM BOT
// =====================================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// =====================================
// YESMS.ONLINE API CONFIGURATION
// =====================================
const GET_NUMBER_API = "https://yesms.online/api/allocate_number";
const OTP_API = "https://yesms.online/api/success_logs";

const YESMS_HEADERS = {
    "Host": "yesms.online",
    "Connection": "keep-alive",
    "sec-ch-ua-platform": '"Android"',
    "User-Agent": "Mozilla/5.0 (Linux; Android 16; V2419 Build/BP2A.250605.031.A3_NN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.91 Mobile Safari/537.36",
    "sec-ch-ua": '"Android WebView";v="149", "Chromium";v="149", "Not)A;Brand\";v=\"24\"',
    "Content-Type": "application/json",
    "sec-ch-ua-mobile": "?1",
    "Accept": "*/*",
    "Origin": "https://yesms.online",
    "X-Requested-With": "mark.via.gp",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Accept-Language": "en,en-GB;q=0.9,en-KE;q=0.8,bn-BD;q=0.7,bn;q=0.6,en-US;q=0.5",
    "Cookie": process.env.YESMS_COOKIE
};

// =====================================
// TEMP ADMIN STATE
// =====================================
const adminState = {};

// =====================================
// UTILITY FUNCTIONS
// =====================================
async function checkMembership(chatId) {
    if (ADMIN_IDS.includes(chatId)) return true; 
    try {
        const member = await bot.getChatMember(REQUIRED_GROUP_ID, chatId);
        const activeStatuses = ["creator", "administrator", "member", "restricted"];
        return activeStatuses.includes(member.status);
    } catch (e) {
        console.log("Membership check error:", e.message);
        return false;
    }
}

function sendJoinMessage(chatId) {
    bot.sendMessage(
        chatId,
        "hi please join our OTP group to use this bot",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "OTP Group", url: GROUP_LINK }]
                ]
            }
        }
    );
}

function maskNumber(numStr) {
    const clean = numStr.startsWith('+') ? numStr.slice(1) : numStr;
    if (clean.length <= 7) return numStr;
    const first3 = clean.slice(0, 3);
    const last4 = clean.slice(-4);
    return `+${first3}***${last4}`;
}

// Helper to prevent HTML syntax injection from broken SMS strings
// This stops Telegram from throwing parsing errors
function escapeHTML(text) {
    if (!text) return "";
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// =====================================
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// =====================================
bot.on("callback_query", async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    bot.answerCallbackQuery(callbackQuery.id);

    const isMember = await checkMembership(chatId);
    if (!isMember) return sendJoinMessage(chatId);

    if (data.startsWith("select_country:")) {
        const countryName = data.split(":")[1];
        const selectedCountry = await Country.findOne({ name: countryName });
        
        if (selectedCountry) {
            bot.deleteMessage(chatId, msg.message_id).catch((e) => 
                console.log("Error deleting menu message:", e.message)
            );

            return getNumber(chatId, selectedCountry);
        } else {
            return bot.sendMessage(chatId, "❌ Country not found");
        }
    }

    if (data === "change_num") {
        const user = await User.findOne({ chatId });
        if (!user) {
            return bot.sendMessage(chatId, "❌ No active number");
        }

        const country = await Country.findOne({ name: user.country });
        if (!country) {
            return bot.sendMessage(chatId, "❌ Country not found");
        }

        return getNumber(chatId, country);
    }

    if (data === "change_country") {
        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "❌ No country available");
        }

        return bot.sendMessage(
            chatId,
            "🌐 Select a country ⬇️",
            {
                reply_markup: {
                    inline_keyboard: countries.map(c => [
                        { text: c.name, callback_data: `select_country:${c.name}` }
                    ])
                }
            }
        );
    }
});

// =====================================
// MESSAGE HANDLER
// =====================================
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    const isMember = await checkMembership(chatId);
    if (!isMember) return sendJoinMessage(chatId);

    if (text === "/start") {
        return bot.sendMessage(
            chatId,
            "🤖 OTP BOT READY",
            {
                reply_markup: {
                    keyboard: [["🌍 Get Number"]],
                    resize_keyboard: true
                }
            }
        );
    }

    if (text === "/admin") {
        if (!ADMIN_IDS.includes(chatId)) return;

        return bot.sendMessage(
            chatId,
            "⚙️ ADMIN PANEL",
            {
                reply_markup: {
                    keyboard: [
                        ["➕ Add Country"],
                        ["➖ Remove Country"],
                        ["📋 Country List"]
                    ],
                    resize_keyboard: true
                }
            }
        );
    }

    if (text === "➕ Add Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "country_name" };
        return bot.sendMessage(chatId, "Send country name");
    }

    if (adminState[chatId] && adminState[chatId].step === "country_name") {
        adminState[chatId].countryName = text;
        adminState[chatId].step = "country_range";
        return bot.sendMessage(chatId, "Send range ID for yesms\n\nExample:\n236729XXX");
    }

    if (adminState[chatId] && adminState[chatId].step === "country_range") {
        await Country.create({
            name: adminState[chatId].countryName,
            range: text
        });
        delete adminState[chatId];
        return bot.sendMessage(chatId, "✅ Country Added");
    }

    if (text === "➖ Remove Country" && ADMIN_IDS.includes(chatId)) {
        adminState[chatId] = { step: "remove_country" };
        return bot.sendMessage(chatId, "Send exact country name");
    }

    if (adminState[chatId] && adminState[chatId].step === "remove_country") {
        await Country.deleteOne({ name: text });
        delete adminState[chatId];
        return bot.sendMessage(chatId, "✅ Country Removed");
    }

    if (text === "📋 Country List" && ADMIN_IDS.includes(chatId)) {
        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "No countries");
        }

        let result = "🌍 COUNTRY LIST\n\n";
        countries.forEach((c, i) => {
            result += `${i + 1}. ${c.name}\n`;
            result += `Range ID: ${c.range}\n\n`;
        });
        return bot.sendMessage(chatId, result);
    }

    if (text === "🌍 Get Number") {
        const countries = await Country.find();
        if (!countries.length) {
            return bot.sendMessage(chatId, "❌ No country available");
        }

        return bot.sendMessage(
            chatId,
            "🌐 Select a country ⬇️",
            {
                reply_markup: {
                    inline_keyboard: countries.map(c => [
                        { text: c.name, callback_data: `select_country:${c.name}` }
                    ])
                }
            }
        );
    }
});

// =====================================
// GET NUMBER FUNCTION
// =====================================
async function getNumber(chatId, country) {
    try {
        const oldUser = await User.findOne({ chatId });
        if (oldUser) {
            await User.updateOne({ chatId }, { otpReceived: true });
        }

        const response = await axios.post(
            GET_NUMBER_API,
            { range_id: country.range },
            { headers: YESMS_HEADERS, timeout: 15000 }
        );
        const resData = response.data;

        if (!resData || resData.success !== true || !resData.data || !resData.data.full_number) {
            return bot.sendMessage(chatId, "❌ Failed to allocate number from YesMS");
        }

        const numData = resData.data;

        await User.findOneAndUpdate(
            { chatId },
            {
                chatId,
                number: numData.full_number,
                number_id: numData.full_number, 
                country: numData.country || country.name,
                otpReceived: false
            },
            { upsert: true }
        );

        // Updated to HTML mode for absolute layout safety
        await bot.sendMessage(
            chatId,
            `📱 <b>NUMBER</b>\n\n<code>${escapeHTML(numData.full_number)}</code>\n\n🌍 Country: ${escapeHTML(numData.country || country.name)}\n📡 Operator: ${escapeHTML(numData.operator || 'Unknown')}\n\nTap the number to copy`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔄 Change Number", callback_data: "change_num" },
                            { text: "🌍 Change Country", callback_data: "change_country" }
                        ]
                    ]
                }
            }
        );

        startOtpChecker(chatId, numData.full_number);
    } catch (e) {
        console.log("Allocation Error:", e.message);
        bot.sendMessage(chatId, "❌ YesMS API Communication Error");
    }
}

// =====================================
// OTP CHECKER & GROUP FORWARDER ENGINE
// =====================================
function startOtpChecker(chatId, numberId) {
    const interval = setInterval(async () => {
        try {
            const user = await User.findOne({ chatId });

            if (!user || user.number_id !== numberId || user.otpReceived) {
                clearInterval(interval);
                return;
            }

            const response = await axios.get(OTP_API, { headers: YESMS_HEADERS, timeout: 15000 });
            const resData = response.data;

            if (!resData || !Array.isArray(resData.logs) || resData.logs.length === 0) {
                return;
            }

            const userNumber = user.number.replace(/[^0-9]/g, "");
            const match = resData.logs.find(
                (entry) => entry.number.replace(/[^0-9]/g, "") === userNumber
            );

            if (!match) return;
            
            await User.updateOne({ chatId }, { otpReceived: true });

            // Strip out non-digits from code to maintain solid format layout
            let rawOtp = match.code ? match.code.toString() : match.message;
            let otpCode = rawOtp.replace(/\D/g, ""); 

            if (otpCode.length > 6) {
                otpCode = otpCode.slice(0, 6);
            }

            // Secure and escape dynamic variables before injecting into HTML strings
            const safeMsg = escapeHTML(match.message);
            const maskedNumberStr = escapeHTML(maskNumber(user.number));

            // 1. Send to User Private Chat Box (HTML Code tag enables Tap to Copy)
            await bot.sendMessage(
                chatId,
                `✅ <b>OTP RECEIVED</b>\n\n🔐 OTP: <code>${otpCode}</code>\n\n📩 Message:\n<code>${safeMsg}</code>`,
                { parse_mode: "HTML" }
            ).catch((err) => console.log("Private payload crash prevented:", err.message));

            // 2. 🔥 FORWARD TO TELEGRAM GROUP
            // HTML <code> tag ensures Click-to-Copy works flawlessly here too
            const groupPayload = `New OTP Received 🔥\n\n📱 <b>Number:</b> ${maskedNumberStr}\n🔐 <b>OTP:</b> <code>${otpCode}</code>\n\n📩 <b>Full Message:</b>\n<code>${safeMsg}</code>`;

            console.log(`[FORWARDING] Attempting transmission to Group ID: ${REQUIRED_GROUP_ID}`);

            await bot.sendMessage(REQUIRED_GROUP_ID, groupPayload, { parse_mode: "HTML" })
                .then(() => console.log("✅ [SUCCESS] Group forwarding complete!"))
                .catch((err) => {
                    console.error("❌ [FAILURE] Telegram Group forwarding failed rejection logs:");
                    if (err.response && err.response.body) {
                        console.error(JSON.stringify(err.response.body, null, 2));
                    } else {
                        console.error(err);
                    }
                });

            clearInterval(interval);

        } catch (e) {
            console.log("Poller Loop Error Exception:", e.message);
        }
    }, 4000);
}

bot.on("polling_error", console.log);
console.log("BOT RUNNING...");
