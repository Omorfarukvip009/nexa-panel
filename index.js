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
    "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/getnum";

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

                inline_keyboard: [
                    [
                        {
                            text: "🌍 Get Number",
                            callback_data: "get_number"
                        }
                    ]
                ]

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
    // COUNTRY SELECT (legacy text fallback removed)
    // =================================

});

// =====================================
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// =====================================

bot.on("callback_query", async (query) => {

    const chatId =
        query.message.chat.id;

    const data =
        query.data;

    // ACK the callback so the button stops loading

    bot.answerCallbackQuery(
        query.id
    ).catch(() => {});

    // =================================
    // GET NUMBER -> SHOW COUNTRY LIST
    // =================================

    if (data === "get_number") {

        // DELETE PREVIOUS MESSAGE FOR CLEAN INBOX

        bot.deleteMessage(
            chatId,
            query.message.message_id
        ).catch(() => {});

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

            "🌍 Select a country ⬇️",

            {
                reply_markup: {

                    inline_keyboard:
                        countries.map(
                            c => [
                                {
                                    text: c.name,
                                    callback_data: `country_${c._id}`
                                }
                            ]
                        )

                }
            }

        );

    }

    // =================================
    // COUNTRY SELECTED -> GET 3 NUMBERS
    // =================================

    if (data.startsWith("country_")) {

        const countryId =
            data.replace("country_", "");

        const selectedCountry =
            await Country.findById(
                countryId
            );

        if (!selectedCountry) {

            return bot.sendMessage(

                chatId,

                "❌ Country not found"

            );

        }

        // DELETE PREVIOUS MESSAGE FOR CLEAN INBOX

        bot.deleteMessage(
            chatId,
            query.message.message_id
        ).catch(() => {});

        return getNumbers(
            chatId,
            selectedCountry
        );

    }

    // =================================
    // CHANGE NUMBER -> GET 3 NEW NUMBERS
    // =================================

    if (data === "change_number") {

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

        // DELETE PREVIOUS MESSAGE FOR CLEAN INBOX

        bot.deleteMessage(
            chatId,
            query.message.message_id
        ).catch(() => {});

        return getNumbers(
            chatId,
            country
        );

    }

});

async function getNumbers(
    chatId,
    country
) {

    try {

        const fetched = [];

        // FETCH 3 NUMBERS

        for (let i = 0; i < 3; i++) {

            try {

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

                if (
                    !resData ||
                    !resData.meta ||
                    resData.meta.code !== 200 ||
                    !resData.data ||
                    !resData.data.full_number
                ) {

                    continue;

                }

                const numData =
                    resData.data;

                fetched.push({

                    number:
                        numData.full_number,

                    number_id:
                        resData.rid || numData.no_plus_number,

                    operator:
                        numData.operator,

                    countryName:
                        numData.country || country.name,

                    otpReceived: false

                });

            } catch (e) {

                console.log(
                    "GET NUMBER ERROR:",
                    e.message
                );

            }

        }

        if (!fetched.length) {

            return bot.sendMessage(

                chatId,

                "❌ Failed to get number"

            );

        }

        // SAVE USER (REPLACE OLD NUMBERS)

        await User.findOneAndUpdate(

            { chatId },

            {

                chatId,

                country:
                    fetched[0].countryName,

                numbers: fetched

            },

            {
                upsert: true
            }

        );

        // BUILD MESSAGE TEXT

        let message =
            `📱 NUMBERS\n\n`;

        fetched.forEach((n, i) => {

            message +=
                `${i + 1}. \`${n.number}\`\n`;

            message +=
                `   🌍 ${n.countryName} | 📡 ${n.operator}\n\n`;

        });

        message +=
            `Tap a number to copy`;

        // SEND NUMBERS

        await bot.sendMessage(

            chatId,

            message,

            {

                parse_mode:
                    "Markdown",

                reply_markup: {

                    inline_keyboard: [

                        [
                            {
                                text: "🌍 Get Number",
                                callback_data: "get_number"
                            }
                        ],

                        [
                            {
                                text: "🔄 Change Number",
                                callback_data: "change_number"
                            }
                        ]

                    ]

                }
            }

        );

        // START CHECKER FOR ALL 3 NUMBERS

        startOtpChecker(
            chatId,
            fetched.map(n => n.number_id)
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
    "https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/success-otp";

function startOtpChecker(
    chatId,
    numberIds
) {

    const interval =
        setInterval(async () => {

            try {

                const user =
                    await User.findOne({
                        chatId
                    });

                if (
                    !user ||
                    !Array.isArray(user.numbers) ||
                    !user.numbers.length
                ) {
                    clearInterval(interval);
                    return;
                }

                // ONLY CHECK NUMBERS FROM THIS BATCH, STILL PENDING

                const pending =
                    user.numbers.filter(
                        (n) =>
                            numberIds.includes(n.number_id) &&
                            !n.otpReceived
                    );

                // STOP IF NUMBERS WERE REPLACED (CHANGE NUMBER) OR ALL RECEIVED

                const stillTracked =
                    user.numbers.some(
                        (n) =>
                            numberIds.includes(n.number_id)
                    );

                if (!stillTracked || !pending.length) {
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

                // CHECK EACH PENDING NUMBER FOR A MATCHING OTP

                for (const n of pending) {

                    const numberDigits =
                        n.number.replace(/[^0-9]/g, "");

                    const match =
                        resData.data.otps.find(
                            (entry) =>
                                entry.number.replace(/[^0-9]/g, "") === numberDigits
                        );

                    if (!match) {
                        continue;
                    }

                    // MARK THIS NUMBER AS RECEIVED

                    await User.updateOne(

                        { chatId },

                        {
                            $set: {
                                "numbers.$[elem].otpReceived": true
                            }
                        },

                        {
                            arrayFilters: [
                                { "elem.number_id": n.number_id }
                            ]
                        }

                    );

                    // Extract OTP code: first digits in message

                    const cleaned =
                        match.message.replace(/\D/g, "");

                    const otpCode =
                        cleaned.slice(0, 6);

                    await bot.sendMessage(

                        chatId,

                        `✅ OTP RECEIVED\n\n📱 Number:\n\`${n.number}\`\n\n🔐 OTP: \`${otpCode}\`\n\n📩 Message:\n\`${match.message}\``,

                        {
                            parse_mode: "Markdown"
                        }

                    );

                    // STOP CHECKING ONCE ANY NUMBER SUCCEEDS

                    clearInterval(interval);

                    return;

                }

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
