/** 
 * @author Dipesh Singh Reen
*/

const mongoose = require('mongoose');

const recTranSchema = mongoose.Schema({
    user_id:{
        type: String,
        required: true,
        unique:true
    },
    recurrences:[{
        name:{
            type: String,
            required: true,
            unique:true
        },
        possibilities:[{
            last_name:{
                type:String,
                required: true
            },
            recurring_flag:{
                type: Boolean,
                required: true
            },
            next_amt: {
                type: Number,
                required: true
            },
            last_date: {
                type: Date,
                required: true,
                default: Date.now
            },
            mean_period:{
                type: Number,
                required: true
            },
            transactions:{
                type: Array,
                required: true
            }
        }]
    }]
});

const RecTrans = mongoose.model('Recurrence', recTranSchema);


// module.exports.getRecurringTransactions = (callback, limit) => {
//     RecTrans.find(callback).limit(limit);
// };

// GET call to the collection 'recurrences'
module.exports.getRecurringTransactionsByUser = (user_id, callback) => {
    RecTrans.find({user_id: user_id}, callback);
};

// POST call to the collection 'recurrences'
module.exports.addRecurringTransactions = (transactions, callback) => {
    RecTrans.create(transactions, callback);
};

// PUT call to the collection 'recurrences'
module.exports.updateRecurringTransactions = (user_id, userRecurrences, options, callback) => {
    const query = { 'user_id': user_id};
    const update = { 'recurrences': userRecurrences.recurrences};
    RecTrans.findOneAndUpdate(query, update, options, callback);
}

