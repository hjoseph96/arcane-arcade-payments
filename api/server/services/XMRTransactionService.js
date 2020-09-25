import database from '../src/models';

class XMRTransactionService {
  static async getAllTransactions() {
    try {
      return await database.XMRTransaction.findAll();
    } catch (error) {
      throw error;
    }
  }

  static async addTransaction(newTransaction) {
    try {
      return await database.XMRTransaction.create(newTransaction);
    } catch (error) {
      throw error;
    }
  }

  static async getTransaction(id) {
    try {
      const theTransaction = await database.XMRTransaction.findOne({
        where: { id: UUID(id) }
      });

      return theTransaction;
    } catch (error) {
      throw error;
    }
  }
  
  static async findByTransactionId(tx_id) {
    try {
      const theTransaction = await database.XMRTransaction.findOne({
        where: { tx_id: String(tx_id) }
      });

      return theTransaction;
    } catch (error) {
      throw error;
    }
  }
}

export default XMRTransactionService;