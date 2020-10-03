import Util from '../utils/Utils';
import Coinjs from '../../vendor/coin';

import XMRTransactionService from '../services/XMRTransactionService';

const util = new Util();

class XMRTransactionController {
  static async getAllTransactions(req, res) {
    try {
      const allTransactions = await XMRTransactionService.getAllTransactions();

      if (allTransactions.length > 0) {
        util.setSuccess(200, 'XMR Transactions retrieved', allTransactions);
      } else {
        util.setSuccess(200, 'No Transaction found');
      }

      return util.send(res);
    } catch (error) {
        console.log(error);

        util.setError(400, error);
        return util.send(res);
    }
  }

  static async addTransaction(req, res) {
    const {
      tx_id, tx_n, coin_amount, fee_amount, fee_address,
      return_amount, target_address, script_pub_key, sent_from_address
    } = req.body;

    const missingRequiredKeys = !tx_id || !coin_amount || tx_n ||
                                !fee_amount || !fee_address || !return_amount ||
                                !target_address || !script_pub_key || !sent_from_address
    if (missingRequiredKeys) {
      util.setError(400, 'Please provide complete details');
      return util.send(res);
    }

    const coins = Coinjs;
    if (req.body.testing) coins.setToTestnet();

    const paymentOutputs = [
      { address: target_address, amount: coin_amount },
      { address: fee_address,   amount: fee_amount },
    ];
    if (return_amount > 0) {
      paymentOutputs.push({ address: sent_from_address, amount: return_amount })
    }

    const paymentInputs = [
      {
        transaction_id: tx_id,
        transaction_id_n: tx_n,
        transaction_id_script: script_pub_key
      }
    ]
    const newTransaction = {
      paymentInputs: paymentInputs,
      paymentOutputs: paymentOutputs
    };

    const tx = coins.createTransaction(newTransaction);
    const transactionAttrs = {
      payment_inputs: newTransaction.paymentInputs,
      payment_outputs: newTransaction.paymentOutputs,
      raw_transaction: tx
    };

    try {
      const createdTransaction = await TransactionService.addTransaction(transactionAttrs);
      util.setSuccess(201, 'Transaction Added!', createdTransaction);
      return util.send(res);
    } catch (error) {
      util.setError(400, error.message);
      return util.send(res);
    }
  }

  static async getTransaction(req, res) {
    const { id } = req.params;

    if (!Number(id)) {
      util.setError(400, 'Please input a valid numeric value');
      return util.send(res);
    }

    try {
      const theTransaction = await TransactionService.getTransaction(id);

      if (!theTransaction) {
        util.setError(404, `Cannot find Transaction with the id ${id}`);
      } else {
        util.setSuccess(200, 'Found Transaction', theTransaction);
      }
      return util.send(res);
    } catch (error) {
      util.setError(404, error);
      return util.send(res);
    }
  }
}

export default XMRTransactionController;
