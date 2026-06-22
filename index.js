require("dotenv").config(); [span_1](start_span)//[span_1](end_span)
const TelegramBot = require("node-telegram-bot-api"); [span_2](start_span)//[span_2](end_span)
const axios = require("axios"); [span_3](start_span)//[span_3](end_span)
const express = require("express"); [span_4](start_span)//[span_4](end_span)
const connectDB = require("./db"); [span_5](start_span)//[span_5](end_span)
const Country = require("./models/Country"); [span_6](start_span)//[span_6](end_span)
const User = require("./models/User"); [span_7](start_span)//[span_7](end_span)

// =====================================
// CONNECT DATABASE
// =====================================
connectDB(); [span_8](start_span)//[span_8](end_span)

// =====================================
// EXPRESS SERVER
// =====================================
const app = express(); [span_9](start_span)//[span_9](end_span)
const PORT = process.env.PORT || 3000; [span_10](start_span)//[span_10](end_span)

[span_11](start_span)app.get("/", (req, res) => { //[span_11](end_span)
    res.send(`
        <html>
            <head>
                <title>OTP Bot</title>
                <style>
                    body{
                        [span_12](start_span)background:#0f172a; //[span_12](end_span)
                        color:white;
                        display:flex;
                        justify-content:center;
                        align-items:center; [span_13](start_span)//[span_13](end_span)
                        height:100vh;
                        margin:0;
                        flex-direction:column;
                        font-family:Arial;
                    }
                    h1{
                        color:#22c55e; [span_14](start_span)//[span_14](end_span)
                        font-size:55px;
                    [span_15](start_span)} //[span_15](end_span)
                    p{
                        color:#cbd5e1;
                        font-size:22px;
                    }
                [span_16](start_span)</style> //[span_16](end_span)
            </head>
            <body>
                <h1>✅ BOT RUNNING</h1>
                <p>Telegram OTP Bot Active</p>
            </body>
        </html>
    `);
}); [span_17](start_span)//[span_17](end_span)

app.listen(PORT, () => {
    console.log("Web Server Running");
});

// =====================================
// ADMIN & GROUP CONFIGURATION
// =====================================
const ADMIN_IDS = [5948588400]; [span_18](start_span)//[span_18](end_span)
const REQUIRED_GROUP_ID = -1003724610035;
const GROUP_LINK = "https://t.me/+ROInVYWEN-czMjI1";

// =====================================
// TELEGRAM BOT
// =====================================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true }); [span_19](start_span)//[span_19](end_span)

// =====================================
// API CONFIG (YESMS.ONLINE)
// =====================================
const GET_NUMBER_API = "https://yesms.online/api/allocate_number";
const OTP_API = "https://yesms.online/api/success_logs";

const YESMS_HEADERS = {
    "Host": "yesms.online",
    "Connection": "keep-alive",
    "sec-ch-ua-platform": '"Android"',
    "User-Agent": "Mozilla/5.0 (Linux; Android 16; V2419 Build/BP2A.250605.031.A3_NN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.91 Mobile Safari/537.36",
    "sec-ch-ua": '"Android WebView";v="149", "Chromium";v="149", "Not)A;Brand\";v="24"',
    "Content-Type": "application/json",
    "sec-ch-ua-mobile": "?1",
    "Accept": "*/*",
    "Origin": "https://yesms.online",
    "X-Requested-With": "mark.via.gp",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Accept-Language": "en,en-GB;q=0.9,en-KE;q=0.8,bn-BD;q=0.7,bn;q=0.6,en-US;q=0.5",
    "Cookie": "session=5948588400:ba9e655756bd8e68baaccca203493fec"
};

// =====================================
// TEMP ADMIN STATE
// =====================================
const adminState = {}; [span_20](start_span)//[span_20](end_span)

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

// =====================================
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// =====================================
bot.on("callback_query", async (callbackQuery) => {
    [span_21](start_span)const msg = callbackQuery.message; //[span_21](end_span)
    const chatId = msg.chat.id; [span_22](start_span)//[span_22](end_span)
    const data = callbackQuery.data; [span_23](start_span)//[span_23](end_span)

    bot.answerCallbackQuery(callbackQuery.id); [span_24](start_span)//[span_24](end_span)

    // Verify Membership
    const isMember = await checkMembership(chatId);
    if (!isMember) return sendJoinMessage(chatId);

    // Handle Country Selection
    [span_25](start_span)if (data.startsWith("select_country:")) { //[span_25](end_span)
        const countryName = data.split(":")[1]; [span_26](start_span)//[span_26](end_span)
        const selectedCountry = await Country.findOne({ name: countryName }); [span_27](start_span)//[span_27](end_span)
        
        [span_28](start_span)if (selectedCountry) { //[span_28](end_span)
            [span_29](start_span)bot.deleteMessage(chatId, msg.message_id).catch((e) => //[span_29](end_span)
                [span_30](start_span)console.log("Error deleting menu message:", e.message) //[span_30](end_span)
            );

            return getNumber(chatId, selectedCountry); [span_31](start_span)//[span_31](end_span)
        [span_32](start_span)} else { //[span_32](end_span)
            return bot.sendMessage(chatId, "❌ Country not found"); [span_33](start_span)//[span_33](end_span)
        [span_34](start_span)} //[span_34](end_span)
    }

    // Handle Inline Change Number
    [span_35](start_span)if (data === "change_num") { //[span_35](end_span)
        const user = await User.findOne({ chatId }); [span_36](start_span)//[span_36](end_span)
        [span_37](start_span)if (!user) { //[span_37](end_span)
            return bot.sendMessage(chatId, "❌ No active number"); [span_38](start_span)//[span_38](end_span)
        [span_39](start_span)} //[span_39](end_span)

        const country = await Country.findOne({ name: user.country }); [span_40](start_span)//[span_40](end_span)
        [span_41](start_span)if (!country) { //[span_41](end_span)
            return bot.sendMessage(chatId, "❌ Country not found"); [span_42](start_span)//[span_42](end_span)
        [span_43](start_span)} //[span_43](end_span)

        return getNumber(chatId, country); [span_44](start_span)//[span_44](end_span)
    [span_45](start_span)} //[span_45](end_span)

    // Handle Inline Change Country
    [span_46](start_span)if (data === "change_country") { //[span_46](end_span)
        const countries = await Country.find(); [span_47](start_span)//[span_47](end_span)
        [span_48](start_span)if (!countries.length) { //[span_48](end_span)
            return bot.sendMessage(chatId, "❌ No country available"); [span_49](start_span)//[span_49](end_span)
        [span_50](start_span)} //[span_50](end_span)

        [span_51](start_span)return bot.sendMessage( //[span_51](end_span)
            chatId,
            "🌐 Select a country ⬇️",
            {
                reply_markup: {
                    [span_52](start_span)inline_keyboard: countries.map(c => [ //[span_52](end_span)
                        [span_53](start_span){ text: `${c.name} - ( ${c.range} )`, callback_data: `select_country:${c.name}` } //[span_53](end_span)
                    ])
                }
            }
        ); [span_54](start_span)//[span_54](end_span)
    }
});

// =====================================
// MESSAGE HANDLER
// =====================================
bot.on("message", async (msg) => {
    [span_55](start_span)const chatId = msg.chat.id; //[span_55](end_span)
    const text = msg.text; [span_56](start_span)//[span_56](end_span)

    if (!text) return; [span_57](start_span)//[span_57](end_span)

    // Verify Membership
    const isMember = await checkMembership(chatId);
    if (!isMember) return sendJoinMessage(chatId);

    // START COMMAND
    if (text === "/start") {
        return bot.sendMessage(
            chatId,
            [span_58](start_span)"🤖 OTP BOT READY", //[span_58](end_span)
            {
                reply_markup: {
                    [span_59](start_span)keyboard: [["🌍 Get Number"]], //[span_59](end_span)
                    [span_60](start_span)resize_keyboard: true //[span_60](end_span)
                }
            }
        );
    }

    // ADMIN PANEL
    [span_61](start_span)if (text === "/admin") { //[span_61](end_span)
        if (!ADMIN_IDS.includes(chatId)) return; [span_62](start_span)//[span_62](end_span)

        [span_63](start_span)return bot.sendMessage( //[span_63](end_span)
            chatId,
            [span_64](start_span)"⚙️ ADMIN PANEL", //[span_64](end_span)
            {
                reply_markup: {
                    [span_65](start_span)keyboard: [ //[span_65](end_span)
                        [span_66](start_span)["➕ Add Country"], //[span_66](end_span)
                        [span_67](start_span)["➖ Remove Country"], //[span_67](end_span)
                        [span_68](start_span)["📋 Country List"] //[span_68](end_span)
                    ],
                    [span_69](start_span)resize_keyboard: true //[span_69](end_span)
                }
            }
        ); [span_70](start_span)//[span_70](end_span)
    }

    // ADD COUNTRY
    [span_71](start_span)if (text === "➕ Add Country" && ADMIN_IDS.includes(chatId)) { //[span_71](end_span)
        adminState[chatId] = { step: "country_name" }; [span_72](start_span)//[span_72](end_span)
        return bot.sendMessage(chatId, "Send country name"); [span_73](start_span)//[span_73](end_span)
    }

    // COUNTRY NAME
    [span_74](start_span)if (adminState[chatId] && adminState[chatId].step === "country_name") { //[span_74](end_span)
        adminState[chatId].countryName = text; [span_75](start_span)//[span_75](end_span)
        adminState[chatId].step = "country_range"; [span_76](start_span)//[span_76](end_span)
        return bot.sendMessage(chatId, "Send range\n\nExample:\n236729XXX");
    }

    // COUNTRY RANGE
    [span_77](start_span)if (adminState[chatId] && adminState[chatId].step === "country_range") { //[span_77](end_span)
        [span_78](start_span)await Country.create({ //[span_78](end_span)
            [span_79](start_span)name: adminState[chatId].countryName, //[span_79](end_span)
            [span_80](start_span)range: text //[span_80](end_span)
        }); [span_81](start_span)//[span_81](end_span)
        delete adminState[chatId]; [span_82](start_span)//[span_82](end_span)
        return bot.sendMessage(chatId, "✅ Country Added"); [span_83](start_span)//[span_83](end_span)
    }

    // REMOVE COUNTRY
    [span_84](start_span)if (text === "➖ Remove Country" && ADMIN_IDS.includes(chatId)) { //[span_84](end_span)
        adminState[chatId] = { step: "remove_country" }; [span_85](start_span)//[span_85](end_span)
        return bot.sendMessage(chatId, "Send exact country name"); [span_86](start_span)//[span_86](end_span)
    }

    [span_87](start_span)if (adminState[chatId] && adminState[chatId].step === "remove_country") { //[span_87](end_span)
        await Country.deleteOne({ name: text }); [span_88](start_span)//[span_88](end_span)
        delete adminState[chatId]; [span_89](start_span)//[span_89](end_span)
        return bot.sendMessage(chatId, "✅ Country Removed"); [span_90](start_span)//[span_90](end_span)
    }

    // COUNTRY LIST
    [span_91](start_span)if (text === "📋 Country List" && ADMIN_IDS.includes(chatId)) { //[span_91](end_span)
        const countries = await Country.find(); [span_92](start_span)//[span_92](end_span)
        [span_93](start_span)if (!countries.length) { //[span_93](end_span)
            return bot.sendMessage(chatId, "No countries"); [span_94](start_span)//[span_94](end_span)
        [span_95](start_span)} //[span_95](end_span)

        let result = "🌍 COUNTRY LIST\n\n"; [span_96](start_span)//[span_96](end_span)
        [span_97](start_span)countries.forEach((c, i) => { //[span_97](end_span)
            result += `${i + 1}. ${c.name}\n`; [span_98](start_span)//[span_98](end_span)
            result += `Range: ${c.range}\n\n`; [span_99](start_span)//[span_99](end_span)
        }); [span_100](start_span)//[span_100](end_span)
        return bot.sendMessage(chatId, result); [span_101](start_span)//[span_101](end_span)
    }

    // GET NUMBER
    [span_102](start_span)if (text === "🌍 Get Number") { //[span_102](end_span)
        const countries = await Country.find(); [span_103](start_span)//[span_103](end_span)
        [span_104](start_span)if (!countries.length) { //[span_104](end_span)
            return bot.sendMessage(chatId, "❌ No country available"); [span_105](start_span)//[span_105](end_span)
        [span_106](start_span)} //[span_106](end_span)

        [span_107](start_span)return bot.sendMessage( //[span_107](end_span)
            chatId,
            [span_108](start_span)"🌐 Select a country ⬇️", //[span_108](end_span)
            {
                reply_markup: {
                    [span_109](start_span)inline_keyboard: countries.map(c => [ //[span_109](end_span)
                        [span_110](start_span){ text: `${c.name} - ( ${c.range} )`, callback_data: `select_country:${c.name}` } //[span_110](end_span)
                    ])
                }
            }
        ); [span_111](start_span)//[span_111](end_span)
    }
});

// =====================================
// GET NUMBER FUNCTION
// =====================================
[span_112](start_span)async function getNumber(chatId, country) { //[span_112](end_span)
    try {
        const oldUser = await User.findOne({ chatId }); [span_113](start_span)//[span_113](end_span)
        // STOP OLD NUMBER
        [span_114](start_span)if (oldUser) { //[span_114](end_span)
            await User.updateOne({ chatId }, { otpReceived: true }); [span_115](start_span)//[span_115](end_span)
        [span_116](start_span)} //[span_116](end_span)

        // API REQUEST
        [span_117](start_span)const response = await axios.post( //[span_117](end_span)
            GET_NUMBER_API,
            { range_id: country.range },
            { headers: YESMS_HEADERS, timeout: 15000 }
        );
        const resData = response.data; [span_118](start_span)//[span_118](end_span)

        if (!resData || resData.success !== true || !resData.data || !resData.data.full_number) {
            return bot.sendMessage(chatId, "❌ Failed to get number"); [span_119](start_span)//[span_119](end_span)
        }

        const numData = resData.data; [span_120](start_span)//[span_120](end_span)
        // SAVE USER
        [span_121](start_span)await User.findOneAndUpdate( //[span_121](end_span)
            [span_122](start_span){ chatId }, //[span_122](end_span)
            {
                [span_123](start_span)chatId, //[span_123](end_span)
                [span_124](start_span)number: numData.full_number, //[span_124](end_span)
                number_id: numData.full_number,
                [span_125](start_span)country: numData.country || country.name, //[span_125](end_span)
                [span_126](start_span)otpReceived: false //[span_126](end_span)
            },
            [span_127](start_span){ upsert: true } //[span_127](end_span)
        ); [span_128](start_span)//[span_128](end_span)
        // SEND NUMBER
        [span_129](start_span)await bot.sendMessage( //[span_129](end_span)
            chatId,
            [span_130](start_span)`📱 NUMBER\n\n\`${numData.full_number}\`\n\n🌍 Country: ${numData.country}\n📡 Operator: ${numData.operator}\n\nTap the number to copy`, //[span_130](end_span)
            {
                [span_131](start_span)parse_mode: "Markdown", //[span_131](end_span)
                [span_132](start_span)reply_markup: { //[span_132](end_span)
                    [span_133](start_span)inline_keyboard: [ //[span_133](end_span)
                        [
                            [span_134](start_span){ text: "🔄 Change Number", callback_data: "change_num" }, //[span_134](end_span)
                            [span_135](start_span){ text: "🌍 Change Country", callback_data: "change_country" } //[span_135](end_span)
                        ]
                    ]
                }
            }
        ); [span_136](start_span)//[span_136](end_span)
        // START CHECKER
        startOtpChecker(chatId, numData.full_number); [span_137](start_span)//[span_137](end_span)
    [span_138](start_span)} catch (e) { //[span_138](end_span)
        console.log(e.message); [span_139](start_span)//[span_139](end_span)
        bot.sendMessage(chatId, "❌ API Error"); [span_140](start_span)//[span_140](end_span)
    [span_141](start_span)} //[span_141](end_span)
}

// =====================================
// OTP CHECKER & CHANNELS FORWARDER
// =====================================
[span_142](start_span)function startOtpChecker(chatId, numberId) { //[span_142](end_span)
    [span_143](start_span)const interval = setInterval(async () => { //[span_143](end_span)
        try {
            const user = await User.findOne({ chatId }); [span_144](start_span)//[span_144](end_span)

            [span_145](start_span)if (!user || user.number_id !== numberId || user.otpReceived) { //[span_145](end_span)
                clearInterval(interval); [span_146](start_span)//[span_146](end_span)
                return; [span_147](start_span)//[span_147](end_span)
            }

            const response = await axios.get(OTP_API, { headers: YESMS_HEADERS, timeout: 15000 }); [span_148](start_span)//[span_148](end_span)
            const resData = response.data; [span_149](start_span)//[span_149](end_span)

            if (!resData || !Array.isArray(resData.logs) || resData.logs.length === 0) {
                return; [span_150](start_span)//[span_150](end_span)
            }

            const userNumber = user.number.replace(/[^0-9]/g, ""); [span_151](start_span)//[span_151](end_span)
            [span_152](start_span)const match = resData.logs.find( //[span_152](end_span)
                (entry) [span_153](start_span)=> entry.number.replace(/[^0-9]/g, "") === userNumber //[span_153](end_span)
            );

            if (!match) return; [span_154](start_span)//[span_154](end_span)
            
            // Mark true immediately to stop the interval and prevent any repeating cycles
            await User.updateOne({ chatId }, { otpReceived: true }); [span_155](start_span)//[span_155](end_span)

            const otpCode = match.code || match.message.replace(/\D/g, "").slice(0, 6);

            // 1. Send OTP to Private Chat User
            [span_156](start_span)await bot.sendMessage( //[span_156](end_span)
                chatId,
       
