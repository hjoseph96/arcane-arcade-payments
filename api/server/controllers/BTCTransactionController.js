import Util from '../utils/Utils';
import Coinjs from '../../vendor/coin';

import BTCTransactionService from '../services/BTCTransactionService';
import CentralWalletService from '../services/CentralWalletService';


const util = new Util();

class BTCTransactionController {
  static async getAllTransactions(req, res) {
    try {
      const allTransactions = await BTCTransactionService.getAllTransactions();
      if (allTransactions.length > 0) {
        util.setSuccess(200, 'BTC Transactions retrieved', allTransactions);
      } else {
        util.setSuccess(200, 'No Transaction found');
      }
      return util.send(res);
    } catch (error) {
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


  static async signTransaction(req, res) {
    const { id } = req.params;
    const { private_wif_key, test, coin_type } = req.body;

    if (!Number(id)) {
      util.setError(400, 'Please input a valid numeric value');
      return util.send(res);
    } else if (typeof test == 'undefined' || !coin_type) {
      util.setError(400, 'Provide complete details. Missing (test or coin_type)');
      return util.send(res);
    }

    try {
      const theTransaction = await TransactionService.getTransaction(id);

      if (!theTransaction) {
        util.setError(404, `Cannot find Transaction with the id ${id}`);
      }

      const coins = Coinjs

      // Generate new random key, if none supplied
      const wif_key = private_wif_key || coins.newKeys(null).wif

      const tx = coins.transaction()
      const t = tx.deserialize(theTransaction.raw_transaction);
      const signed = t.sign(wif_key, 1)

      if (signed) {
        util.setSuccess(201, 'Transaction Added!', signed);
      } else {
        util.setError(404, `Having trouble signing Transaction#${id}`);
      }

      return util.send(res);
    } catch (error) {
      util.setError(404, error);
      console.log(error);
      return util.send(res);
    }
  }


  static async createWithdrawal(req, res) {
    const missingRequiredKeys = !req.body.target_address || !req.body.coin_amount || !req.body.coin_type
    if (missingRequiredKeys) {
      console.log('Incomplete details for BTC withdrawal.');

      util.setError(400, 'Please provide complete details');
      return util.send(res);
    }

    req.body.coin_amount = parseFloat(req.body.coin_amount);
    if (req.params.coin_type === 'BTC') 
      throw new Error('Invalid coin_type given. Must be BTC');

    try {
      const broadcastedTransactions = await CentralWalletService.withdraw(req.body);

      const promises = broadcastedTransactions.map(async (broadcastTx) => {
        return await BTCTransactionService.addTransaction(broadcastTx);
      });

      const createdTransactions = await Promise.all(promises);
      util.setSuccess(201, 'Transaction Added!', createdTransactions);

      return util.send(res);
    } catch (error) {
      console.log(error);

      util.setError(400, error.message);
      return util.send(res);
    }
  }


  static async fetchStatus(req, res) {
    const { tx_id, coin_type } = req.params;

    if (!String(tx_id)) {
      util.setError(400, 'Please input a valid transaction hash');
      return util.send(res);
    }

    try {
      const theTransaction = await BTCTransactionService.findByTransactionId(tx_id);

      if (!theTransaction) {
        util.setError(404, `Cannot find Transaction with the tx_id: ${tx_id}`);
      } else {
        const btcAPI = new BitcoinExternalAPI(coin_type);
        const txInfo = btcAPI.getTransaction(tx_id);

        util.setSuccess(200, `Successfully fetched status for Transaction#tx_id: ${tx_id}`, txInfo);
      }
    } catch (error) {
      util.setError(404, error);
      return util.send(res);
    }
  }

  static async broadcastTx(req, res) {
    const { coin_type } = req.params;
    const { tx_hex } = req.body;

    if (!String(tx_hex)) {
      util.setError(400, 'Please give a valid signed transaction hex.');
      return util.send(res);
    }

    try {
      const btcAPI = new BitcoinExternalAPI(coin_type);
      const broadcastedHex = btcAPI.broadcastTx(tx_hex);

      util.setSuccess(200, `Successfully broadcasted new transaction to ${coin_type} network`, broadcastedHex);
    } catch (error) {
      util.setError(404, error);
      return util.send(res);
    }
  }
}

export default BTCTransactionController;
