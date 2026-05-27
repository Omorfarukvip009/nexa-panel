const mongoose = require("mongoose");

const CountrySchema =
    new mongoose.Schema({

        name: String,

        range: String

    });

module.exports =
    mongoose.model(
        "Country",
        CountrySchema
    );
