const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    chatId: String,
    number: String,
    number_id: String,
    country: String,
    otpReceived: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", UserSchema);
