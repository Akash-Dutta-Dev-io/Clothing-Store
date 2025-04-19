const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    items: [
        {
            name: String,
            price: Number,
            desc: String,
            image:{type: String},
            quantity: { type: Number, default: 1 }
        }
    ]
});

module.exports = mongoose.model('Cart', cartSchema);
