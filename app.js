/** 
 * @author Dipesh Singh Reen
*/


const express = require('express');
const mongoose = require('mongoose');
const timeout = require('connect-timeout');

const Transaction = require('./transaction');
const Recurring = require('./recurring_transaction');

const app = express();

app.use(express.json());
app.use(timeout('10s'));
app.use(haltOnTimedout);

mongoose.connect('mongodb://localhost/interview_challenge', { useNewUrlParser: true });
const db = mongoose.connection;

app.get('/', (req, res) => {
    res.send(`<div>Use the following APIs: <br /><br />
    1. <b>/api/upsert_transactions</b> (POST): <br />
        &emsp;&emsp; Input: List of Transactions <br />
        &emsp;&emsp; Output: List of recurring Transactions <br />
    2. <b>/api/get_recurring_transactions/:user_id</b> (GET): <br />
        &emsp;&emsp; Input: Nothing (required user_id in the API call) <br />
        &emsp;&emsp; Output: List of recurring transactions for that user <br />
    3. <b>/api/transactions</b> (GET): <br />
        &emsp;&emsp; Input: Nothing <br />
        &emsp;&emsp; Output: List of all the transactions till date </div>`);
});

// API call to fetch all the transactions entered to the system till date
app.get('/api/transactions', (req, res) => {
    Transaction.getTransactions((error, transactions) => {
        if (error) return res.send(error); 
        res.json(transactions);
    });
});

// API call to fetch all the recurring transactions for a specific user
app.get('/api/get_recurring_transactions/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    // Function call to fetch the recurrences for the user from the database
    Recurring.getRecurringTransactionsByUser(user_id, (error, userRecurrences) => {
        if (error) return res.send(error);

        // Function call to format the data into an array of transactions for the output
        let recurringTransactions = formatDataForOutput(userRecurrences);

        res.json(recurringTransactions);
    });
});

// API call to add transactions and find recurrences for the user
app.post('/api/upsert_transactions', (req, res) => {
    const transactions = req.body;
    
    // Function call to add transactions to the database
    Transaction.addTransactions(transactions, (error, transactions) => {
        if (error) return res.send(error);
        
        // Sort transactions by date
        transactions.sort(function (a, b) {
            return new Date(a.date).getTime()-new Date(b.date).getTime();
        });

        // fetch the common user_id 
        const user_id = transactions[0].user_id;
        
        // Fetch the recurrences for the current user from the database
        Recurring.getRecurringTransactionsByUser(user_id, (error, userRecurrences) => {
            if (error) return res.send(error);
            
            let newUser = false;

            // First occurence of the user
            if (userRecurrences.length == 0) {
                userRecurrences.push({'user_id': user_id, 'recurrences':[]});
                newUser = true;
            }

            // recurrenceByUser = {'user_id': current user id, recurrences: Array of company wise recurrences}
            let recurrencesByUser = userRecurrences[0].recurrences;

            // Looping over each transaction added previously to find the recurrences
            transactions.forEach(transaction => {

                // extracting the company name from the transaction name (removing the last purely numerical word)
                const regExp = /^(.+?)(\d*)$/g;
                const transactionSearchName = regExp.exec(transaction['name'])[1];
                
                // check for if the company previously existed for the user
                if (!recurrencesByUser.find(cName => cName.name === transactionSearchName)){
                    recurrencesByUser.push({'name': transactionSearchName, 'possibilities': []});
                }

                // recurrencesByCompany = {'name': name of the company, 'possibilities': array of possible recurrences}
                let recurrencesByCompany = recurrencesByUser.find(cName => cName.name === transactionSearchName);
                
                const currentTransactionObject = {
                    'last_name': transaction.name,
                    'next_amt': transaction.amount,
                    'last_date': transaction.date,
                    'mean_period': 0,
                    'recurring_flag': false,
                    'transactions':[transaction]
                };
                
                let newPossibilities = [];
                
                // looping over each possibility to check with the current transaction
                recurrencesByCompany.possibilities.forEach(possibleGroup => {
                   
                    /** 
                     * Function call to combine the current transaction and the possible recurrence
                     * newCombination = {'valid': state of the combination, 'combinedGroup': successfully combined group}
                    */
                    const newCombination = combine(possibleGroup, currentTransactionObject);
                    
                    // No valid combination, therefore, add the original possibility back
                    if (newCombination.valid === 'false'){
                        newPossibilities.push(possibleGroup);
                    }

                    /**  
                     * New combination, therefore, add both
                     * original possibility: to check for other recurrences starting at this transactions
                     * new combination: only if a group with the same period doesn't already exist (removing redundancy)
                     * */
                    if (newCombination.valid === 'true_new'){
                        newPossibilities.push(possibleGroup);
                        let redundantIndex = newPossibilities.findIndex(v => v.last_name === newCombination.combinedGroup.last_name && Math.abs(v.mean_period - newCombination.combinedGroup.mean_period) < 5);
                        if (redundantIndex == -1) {
                            newPossibilities.push(newCombination.combinedGroup);
                        }
                    }

                    // Adding to a previous group, therefore, only add the new combination back
                    if (newCombination.valid === 'true_old'){
                        newPossibilities.push(newCombination.combinedGroup);
                    }
                });              

                // Add the current transaction to the group of all valid possibilities
                newPossibilities.push(currentTransactionObject);
                
                // Update the recurrences for the user (this will be checked again for the next transaction)
                recurrencesByCompany.possibilities = newPossibilities;
            });

            if (newUser){   // POST call as the user does not exist in the database
                Recurring.addRecurringTransactions(userRecurrences[0], (error, recurringTransactions) => {
                    if (error) return res.send(error);

                    // Function call to format the data into an array of transactions for the output
                    res.json(formatDataForOutput(userRecurrences));
                });
            }
            else{   // PUT call as the user only needs to be updated
                Recurring.updateRecurringTransactions(user_id, userRecurrences[0], (error, recurringTransactions) => {
                    if (error) return res.send(error);
                    
                    // Function call to format the data into an array of transactions for the output
                    res.json(formatDataForOutput(userRecurrences));
                });
            }
        });
    });
});

/**
 * @description Combine the new transaction to the existing group fro a new possible recurrence
 * @param {Object} existingGroup : a recurrence possibility for the user
 * @param {Object} newObject : a new transaction
 * @returns {'valid': state of the combination, combinedGroup: new combination }
 */
function combine(existingGroup, newObject){
    const amtTolerance = 5;
    const dateTolerance = 5;
    
    const dateDifference = Math.abs(Math.round((existingGroup.last_date - newObject.last_date)/(1000 * 3600 * 24)));
    
    // Check for difference in the periodif the group has 2 or more transactions (period only exists for such groups)
    if (Math.abs(dateDifference - existingGroup.mean_period) > dateTolerance && existingGroup.mean_period != 0) return {'valid': 'false', 'combinedGroup':{}};

    // Check if the transaction is in the past
    if (newObject.last_date < existingGroup.last_date) return {'valid': 'false', 'combinedGroup':{}};

    const amtDifference = Math.abs(existingGroup.next_amt - newObject.next_amt);
    
    // Check for difference in the amount
    if (Math.abs(amtDifference > amtTolerance)) return {'valid': 'false', 'combinedGroup':{}};

    // Valid recurrence, therefore, create a new combination
    let combinedGroup = {}
    combinedGroup['last_date'] = newObject.last_date;
    combinedGroup['last_name'] = newObject.last_name;
    combinedGroup['transactions'] = existingGroup.transactions.concat(newObject.transactions);
    combinedGroup['next_amt'] = ((existingGroup.next_amt * (combinedGroup['transactions'].length - 1)) + newObject.next_amt)/combinedGroup['transactions'].length;
    combinedGroup['mean_period'] = ((existingGroup.mean_period * (combinedGroup['transactions'].length - 2)) + dateDifference)/(combinedGroup['transactions'].length - 1);
    combinedGroup['recurring_flag'] = combinedGroup['transactions'].length >= 3;

    // Check if only one tansaction existed in the group previously
    if (existingGroup.transactions.length == 1) return {'valid': 'true_new', 'combinedGroup': combinedGroup};
    else return {'valid': 'true_old', 'combinedGroup': combinedGroup};
}

/**
 * @description Convert data to the specified output format
 * @param {Array} userRecurrences array containing the object {'user_id': current user, 'recurrences': recurrences for the user}
 * @returns allRecurrences - Array of currently active recurring transactions for the user
 */
function formatDataForOutput(userRecurrences){
    let allRecurrences = [];
    let currentRecurrence = {};
    const user_id = userRecurrences[0]['user_id'];
    const dateTolerance = 5;

    // Looping over each company for the user
    userRecurrences[0].recurrences.forEach(recurrence => {
        
        // Looping over each possibility for the comapany
        recurrence.possibilities.forEach(possibleGroup => {
            if (possibleGroup.recurring_flag){
                const next_date = addDays(possibleGroup.last_date, Math.ceil(possibleGroup.mean_period));
                const today = new Date();
                const dateDifference = Math.round((today - next_date)/(1000 * 3600 * 24));
                
                // Check if the recurring transaction is currently active
                if (!(dateDifference > dateTolerance)){
                    currentRecurrence = {
                        'user_id': user_id,
                        'name': possibleGroup.last_name,
                        'next_amt': possibleGroup.next_amt,
                        'next_date': next_date,
                        'transactions': possibleGroup.transactions
                    };
                    allRecurrences.push({...currentRecurrence});
                }
            }
        });
    });

    // Sorting the output data in alphabetical order
    allRecurrences.sort(function(a, b) {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;
    });

    return allRecurrences;
}

/**
 * @description Add 'days' number of days to the 'date' object
 * @param {Date} date
 * @param {Number} days
 * @returns finalDate : modified date object
 */
function addDays(date, days){
    var finalDate = new Date(date);
    finalDate.setDate(date.getDate() + days);
    return finalDate;
}

// Function to handle a 10s timeout
function haltOnTimedout (req, res, next) {
    if (!req.timedout) next()
}

const port = 1984;

app.listen(port, () => {
    console.log(`Listening on port ${port} ...`);
});