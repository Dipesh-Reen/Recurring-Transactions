/** 
 * @author Dipesh Singh Reen
*/

const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    date:{
        type: Date,
        default: Date.now
    },
    amount:{
        type: Number,
        required: true
    },
    trans_id:{
        type: String,
        required: true,
        unique: true
    },
    user_id:{
        type: String,
        required: true
    }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// GET call to the collection 'transactions'
module.exports.getTransactions = (callback, limit) => {
    Transaction.find(callback).limit(limit);
};

//  POST call to the collection 'transactions'
module.exports.addTransactions = (transactions, callback) => {
    Transaction.insertMany(transactions, callback);
};

