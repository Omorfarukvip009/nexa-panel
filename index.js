require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api");

const axios =
    require("axios");

const express =
    require("express");

const connectDB =
    require("./db");

const Country =
    require("./models/Country");

const User =
    require("./models/User");

// =====================================
// CONNECT DATABASE
// =====================================

connectDB();

// =====================================
// EXPRESS SERVER
// =====================================

const app = express();

const PORT =
    process.env.PORT || 3000;

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

                <h1>
                    ✅ BOT RUNNING
                </h1>

                <p>
                    Telegram OTP Bot Active
                </p>

            </body>

        </html>
    `);

});

app.listen(PORT, () => {

    console.log(
        "Web Server Running"
    );

});

// =====================================
// ADMIN IDS
// =====================================

const ADMIN_IDS = [
    5948588400
];

// =====================================
// TELEGRAM BOT
// =====================================

const bot =
    new TelegramBot(

        process.env.BOT_TOKEN,

        {
            polling: true
        }

    );

// =====================================
// API CONFIG
// =====================================

const MAUTH_API =
    process.env.MAUTH_API;

const HEADERS = {

    "mauthapi":
        MAUTH_API,
};

const GET_NUMBER_API =
    "https://api.2oo9.cloud/MXS47FLFX0U/tnevs/@public/api/getnum";

// =====================================
// TEMP ADMIN STATE
// =====================================

const adminState = {};

// =====================================
// START COMMAND
// =====================================

bot.onText(/\/start/, async (msg) => {

    const chatId =
        msg.chat.id;

    bot.sendMessage(

        chatId,

        "🤖 OTP BOT READY",

        {
            reply_markup: {

                keyboard: [
                    ["🌍 Get Number"]
                ],

                resize_keyboard: true

            }
        }

    );

});

// =====================================
// ADMIN PANEL
// =====================================

bot.onText(/\/admin/, async (msg) => {

    const chatId =
        msg.chat.id;

    if (
        !ADMIN_IDS.includes(chatId)
    ) {
        return;
    }

    bot.sendMessage(

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

});

// =====================================
// MESSAGE HANDLER
// =====================================

bot.on("message", async (msg) => {

    const chatId =
        msg.chat.id;

    const text =
        msg.text;

    if (!text) return;

    // =================================
    // ADD COUNTRY
    // =================================

    if (

        text === "➕ Add Country" &&

        ADMIN_IDS.includes(chatId)

    ) {

        adminState[chatId] = {
            step: "country_name"
        };

        return bot.sendMessage(

            chatId,

            "Send country name"

        );

    }

    // COUNTRY NAME

    if (

        adminState[chatId] &&

        adminState[chatId]
        .step === "country_name"

    ) {

        adminState[chatId]
            .countryName = text;

        adminState[chatId]
            .step = "country_range";

        return bot.sendMessage(

            chatId,

            "Send range\n\nExample:\n228983"

        );

    }

    // COUNTRY RANGE

    if (

        adminState[chatId] &&

        adminState[chatId]
        .step === "country_range"

    ) {

        await Country.create({

            name:
                adminState[chatId]
                .countryName,

            range: text

        });

        delete adminState[chatId];

        return bot.sendMessage(

            chatId,

            "✅ Country Added"

        );

    }

    // =================================
    // REMOVE COUNTRY
    // =================================

    if (

        text === "➖ Remove Country" &&

        ADMIN_IDS.includes(chatId)

    ) {

        adminState[chatId] = {
            step: "remove_country"
        };

        return bot.sendMessage(

            chatId,

            "Send exact country name"

        );

    }

    if (

        adminState[chatId] &&

        adminState[chatId]
        .step === "remove_country"

    ) {

        await Country.deleteOne({
            name: text
        });

        delete adminState[chatId];

        return bot.sendMessage(

            chatId,

            "✅ Country Removed"

        );

    }

    // =================================
    // COUNTRY LIST
    // =================================

    if (

        text === "📋 Country List" &&

        ADMIN_IDS.includes(chatId)

    ) {

        const countries =
            await Country.find();

        if (!countries.length) {

            return bot.sendMessage(

                chatId,

                "No countries"

            );

        }

        let result =
            "🌍 COUNTRY LIST\n\n";

        countries.forEach((c, i) => {

            result +=
                `${i + 1}. ${c.name}\n`;

            result +=
                `Range: ${c.range}\n\n`;

        });

        return bot.sendMessage(
            chatId,
            result
        );

    }

    // =================================
    // GET NUMBER
    // =================================

    if (text === "🌍 Get Number") {

        const countries =
            await Country.find();

        if (!countries.length) {

            return bot.sendMessage(

                chatId,

                "❌ No country available"

            );

        }

        return bot.sendMessage(

            chatId,

            "Select Country",

            {
                reply_markup: {

                    keyboard:
                        countries.map(
                            c => [c.name]
                        ),

                    resize_keyboard: true

                }
            }

        );

    }

    // =================================
    // COUNTRY SELECT
    // =================================

    const selectedCountry =
        await Country.findOne({
            name: text
        });

    if (selectedCountry) {

        return getNumber(
            chatId,
            selectedCountry
        );

    }

    // =================================
    // CHANGE NUMBER
    // =================================

    if (text === "🔄 Change Number") {

        const user =
            await User.findOne({
                chatId
            });

        if (!user) {

            return bot.sendMessage(

                chatId,

                "❌ No active number"

            );

        }

        const country =
            await Country.findOne({

                name:
                    user.country

            });

        if (!country) {

            return bot.sendMessage(

                chatId,

                "❌ Country not found"

            );

        }

        return getNumber(
            chatId,
            country
        );

    }

});

// =====================================
// GET NUMBER FUNCTION
// =====================================

async function getNumber(
    chatId,
    country
) {

    try {

        const oldUser =
            await User.findOne({
                chatId
            });

        // STOP OLD NUMBER

        if (oldUser) {

            await User.updateOne(

                { chatId },

                {
                    otpReceived: true
                }

            );

        }

        // API REQUEST

        const response =
            await axios.post(

                GET_NUMBER_API,

                {
                    rid:
                        country.range,
                },

                {
                    headers:
                        HEADERS,

                    timeout:
                        15000
                }

            );

        const resData =
            response.data;

        // Check API success: meta.code 200 and data exists
        if (
            !resData ||
            !resData.meta ||
            resData.meta.code !== 200 ||
            !resData.data ||
            !resData.data.full_number
        ) {

            return bot.sendMessage(

                chatId,

                "❌ Failed to get number"

            );

        }

        const numData = resData.data;

        // SAVE USER

        await User.findOneAndUpdate(

            { chatId },

            {

                chatId,

                number:
                    numData.full_number,

                number_id:
                    resData.rid || numData.no_plus_number,

                country:
                    numData.country || country.name,

                otpReceived:
                    false

            },

            {
                upsert: true
            }

        );

        // SEND NUMBER

        await bot.sendMessage(

            chatId,

            `📱 NUMBER\n\n\`${numData.full_number}\`\n\n🌍 Country: ${numData.country}\n📡 Operator: ${numData.operator}\n\nTap the number to copy`,

            {

                parse_mode:
                    "Markdown",

                reply_markup: {

                    keyboard: [

                        ["🌍 Get Number"],

                        ["🔄 Change Number"]

                    ],

                    resize_keyboard: true

                }
            }

        );

        // START CHECKER

        startOtpChecker(
            chatId,
            resData.rid || numData.no_plus_number
        );

    } catch (e) {

        console.log(
            e.message
        );

        bot.sendMessage(

            chatId,

            "❌ API Error"

        );

    }

}

// =====================================
// OTP CHECKER
// =====================================

const OTP_API =
    "https://api.2oo9.cloud/MXS47FLFX0U/tnevs/@public/api/success-otp";

function startOtpChecker(
    chatId,
    numberId
) {

    const interval =
        setInterval(async () => {

            try {

                const user =
                    await User.findOne({
                        chatId
                    });

                // STOP IF USER GONE / NUMBER CHANGED / ALREADY RECEIVED

                if (
                    !user ||
                    user.number_id !== numberId ||
                    user.otpReceived
                ) {
                    clearInterval(interval);
                    return;
                }

                // FETCH ALL OTPs FROM SHARED ENDPOINT

                const response =
                    await axios.get(

                        OTP_API,

                        {
                            headers: HEADERS,
                            timeout: 15000
                        }

                    );

                const resData =
                    response.data;

                // VALIDATE RESPONSE

                if (
                    !resData ||
                    !resData.meta ||
                    resData.meta.code !== 200 ||
                    !resData.data ||
                    !Array.isArray(resData.data.otps) ||
                    resData.data.otps.length === 0
                ) {
                    return;
                }

                // USER'S NUMBER — strip all non-digits for comparison

                const userNumber =
                    user.number.replace(/[^0-9]/g, "");

                // FIND MATCHING OTP ENTRY

                const match =
                    resData.data.otps.find(
                        (entry) =>
                            entry.number.replace(/[^0-9]/g, "") === userNumber
                    );

                if (!match) {
                    return;
                }

                // OTP MATCHED — mark received and notify user

                await User.updateOne(
                    { chatId },
                    { otpReceived: true }
                );

                // Extract OTP code: first 4–8 digit sequence in message

                const otpCode =
                    match.message.match(/\b\d{4,8}\b/)?.[0] || "—";

                await bot.sendMessage(

                    chatId,

                    `✅ OTP RECEIVED\n\n🔐 OTP: \`${otpCode}\`\n\n📩 Message:\n\`${match.message}\``,

                    {
                        parse_mode: "Markdown"
                    }

                );

                clearInterval(interval);

            } catch (e) {

                console.log(
                    "OTP ERROR:",
                    e.message
                );

            }

        }, 2000);

}

// =====================================
// ERROR HANDLER
// =====================================

bot.on(
    "polling_error",
    console.log
);

console.log(
    "BOT RUNNING..."
);
