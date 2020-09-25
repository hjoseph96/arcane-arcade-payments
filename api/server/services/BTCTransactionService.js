import database from '../src/models';

class BTCTransactionService {
  static async getAllTransactions() {
    try {
      return await database.BTCTransaction.findAll();
    } catch (error) {
      throw error;
    }
  }

  static async addTransaction(newTransaction) {
    try {
      return await database.BTCTransaction.create(newTransaction);
    } catch (error) {
      throw error;
    }
  }

  static async getTransaction(id) {
    try {
      const theTransaction = await database.BTCTransaction.findOne({
        where: { id: Number(id) }
      });

      return theTransaction;
    } catch (error) {
      throw error;
    }
  }
  
  static async findByTransactionId(tx_id) {
    try {
      const theTransaction = await database.BTCTransaction.findOne({
        where: { transaction_id: String(tx_id) }
      });

      return theTransaction;
    } catch (error) {
      throw error;
    }
  }
}

export default BTCTransactionService;