# Recurring-Transactions

* ## Running instructions
  * node .\app.js or nodemon .\app.js

* ## APIs  
1. **/api/upsert_transactions (POST):**  
   * Input: List of Transactions
   * Output: List of recurring Transactions for the user in ascending order of transaction names
1. **/api/get_recurring_transactions/:user_id (GET):**  
   * Input: Nothing (required user_id in the API call)   
   * Output: List of recurring transactions for that user in ascending order of transaction names  
1. **/api/transactions (GET):**  
   * Input: Nothing  
   * Output: List of all the transactions till date  

* ## Database Schemas
   The code creates two main schemas  
1. **Transactions:**  
   * Description: Array of all the transactions entered into the system
   * File: The schema and the relevant functions are stored in *transaction.js*  
2. **Recurrences:**  
   * Description: Array of Objects containing user and their corresponding recurrences  
   * File: The schema and the relevant functions are stored in *recurring_transaction.js*  
   
* ## Conceptual Logic
   In order to extract the recurring transactions from a list of all transactions I do the following tasks:  
   * Loop over all the incoming transactions.  
   * For each transaction in the incoming list, loop over the all the transactions already observed for the specific company.  
   * Check if the new transaction can be combined with the existing combinations.  
   * If they can't be combined, only add old combination to the result.  
      * Example: combine(t1, t2)  =>  t1; where t1 is the old combination, and t2 is the new one  
   * If they can be combined and the old combination has more than 1 transaction, only add the combination to the result  
      * Example: combine(t1, t2)  =>  t1_t1; here t1_t2 is the combination assuming that t2 and t1 could form a recurring transaction  
   * If they can be combined and the old combination has only 1 transaction, add the old combination t1, and then add the new combination t1_t2 only if there does not exist any combination in the result such that the *last_name* and the *mean_period* of that combination matches that of t1_t2. This ensures avoiding redundant additions.  
      * Example: combine(t1, t2)  =>  t1, t1_t2; or,  combine(t1, t2)  =>  t1
      
* ## Major edge cases handled  
 * Mutiple recurring transaction sets existing for the same company. In this case, both the possible sets would be provided in the output list
 * Redundant recurring transactions have been removed. Example, t1_t2_t3_t4 and t2_t3_t4.

* ## Assumptions
  * The tolerance on the deviation for date has been kept as 5 days.
  * The tolerance on the deviation in the amount has been kept as 5 currency units.
  * The code expects that batch_1 of input transactions will always have transactions occuring prior to that in batch_2 if the transactions belong to the same company ans batch_1 is inputed before batch_2.  
  
* ## Possible Improvements
  * The tolerance assumptions can be converted to a perfectage of the field value to make the deviations more managable. So the tolerance can be taken as min(max_tolerance, %value) for very high value and max(min_tolerance, %value) for very low values and (%value) for the values in between.
  
   
  
