import BitcoinAddressService from '../services/BitcoinAddressService';
import Util from '../utils/Utils';

import Coinjs from '../../vendor/coin';
import CryptoConversion from '../utils/CryptoConversion';
import BitcoinExternalAPI from '../utils/BitcoinExternalAPI';
import CentralWalletService from '../services/CentralWalletService';
import BTCTransactionService from '../services/BTCTransactionService';


require('dotenv').config();

const util = new Util();

class BitcoinAddressController {
  static async addAddress(req, res) {
    const coins = Coinjs


    if (!req.body.expires_at || !req.body.deposit_amount) {
      console.log(req.body)
      util.setError(400, 'Please provide complete details');
      return util.send(res);
    }


    const testMode = ['development', 'test'].indexOf(process.env.NODE_ENV) >= 0;

    if (testMode) coins.setToTestnet();

    let newkeys = coins.newKeys(null);
    let sw = coins.bech32Address(newkeys.pubkey);

    const expiresInAnHour   = Date.parse(req.body.expires_at);
    const expectedDeposit   = req.body.deposit_amount;

    const newAddress = {
      active: true,
      wif: newkeys.wif,
      address: newkeys.address,
      expires_at: expiresInAnHour,
      public_key: newkeys.pubkey,
      seg_wit_address: sw.address,
      private_key: newkeys.privkey,
      redeem_script: sw.redeemscript,
      compressed: newkeys.compressed,
      deposit_amount: expectedDeposit
    }

    try {
      const createdAddress = await BitcoinAddressService.addAddress(newAddress);

      console.log(`NEW BTC ADDRESS: ${createdAddress.address}`);
      
      util.setSuccess(201, 'Address Added!', createdAddress);
      return util.send(res);
    } catch (error) {
      console.log(error);

      util.setError(400, error.message);
      return util.send(res);
    }
  }


  static async findByAddress(req, res) {
    const { address } = req.params;

    if (!String(address)) {
      util.setError(400, 'Please input a valid numeric value');
      return util.send(res);
    }

    try {
      const theAddress = await BitcoinAddressService.findByAddress(address);

      if (!theAddress) {
        util.setError(404, `Cannot find Address: ${address}`);
      } else {
        util.setSuccess(200, 'Found Address', theAddress);
      }

      return util.send(res);
    } catch (error) {
      util.setError(404, error);
      return util.send(res);
    }
  }


  static async addressBalance(req, res) {
    const { address, coin_type } = req.params;

    if (!String(address)) {
      console.log(`Invalid address: ${address}`);
      util.setError(400, 'Please give a valid address.');
      return util.send(res);
    }

    try {
      const theAddress = await BitcoinAddressService.findByAddress(address);

      if (!theAddress) {
        util.setError(404, `Cannot find BitcoinAddress with the address: ${address}`);
      } else {
        const btcAPI = new BitcoinExternalAPI(coin_type);
        const balance = await btcAPI.addressBalance(address);

        util.setSuccess(200, `Retrieved Balance for Address: ${address}`, balance);
        return util.send(res);
      }

    } catch (error) {
      console.log(error);

      util.setError(404, error);
      return util.send(res);
    }
  }


  static async centralBalance(req, res) {
    const { coin_type } = req.params;

    if ( !String(coin_type) && coin_type !== 'BTC' ) {
      util.setError(400, 'Only BTC supported.');
      return util.send(res);
    }

    try {
      await CentralWalletService.getCentralBalance(coin_type).then(balance => {
        if (typeof balance !== 'number') {
          util.setError(422, `Unable to retrieve central balance for ${coin_type}`);

        } else {
          util.setSuccess(200, 'Retrieved Central Balance.', balance);
        }

        return util.send(res);
      });
    } catch (error) {
      console.log(error);

      util.setError(404, error);
      return util.send(res);
    }
  }


  static async releaseFunds(req, res) {
    const { address } = req.params;
    const { destination } = req.body;

    if (!String(address)) {
      util.setError(400, 'Please input a valid numeric value');

      return util.send(res);
    }

    try {
      const theAddress = await BitcoinAddressService.findByAddress(address);

      if (!theAddress) {
        util.setError(404, `Cannot find Address: ${address}`);
      } else {
        const centralAddress = await CentralWalletService.fetchOrCreateCentralAddress('BTC');
        const targetAddress = destination;

        const total_amount = theAddress.balance;
        const platform_fee = await CentralWalletService.calculatePlatformFee({
          coin_amount: total_amount,
          coin_type: 'BTC'
        });
        const miners_fee = 0.00014626;


        let amountToSend = Number((total_amount - (miners_fee + platform_fee)).toFixed(8));
        if (amountToSend < 0) {
         const miners_fee = 0.00000426;
        }
        amountToSend = Number((total_amount - (miners_fee + platform_fee)).toFixed(8));

        const btcAPI = new BitcoinExternalAPI('BTC');
        const res = await btcAPI.unspentTXs(theAddress.address);
        const unspentTXs = res.unspents;

        const paymentOutputs = [
          {
            address: targetAddress,
            amount: amountToSend
          },
          {
            address: centralAddress.address,
            amount: platform_fee
          }
        ];

        const paymentInputs = unspentTXs.map((unspentTx) => {
         return {
           transaction_id: unspentTx.tx_id,
           transaction_id_n: unspentTx.tx_n,
           transaction_id_script: unspentTx.script
         }
        });
        const newTransaction = {
         paymentInputs: paymentInputs,
         paymentOutputs: paymentOutputs
        };

        console.log(paymentOutputs);
        console.log(paymentInputs);

        const coins = Coinjs;

        const testMode = ['development', 'test'].indexOf(process.env.NODE_ENV) >= 0;

        if (testMode) coins.setToTestnet();

        const tx = coins.createTransaction(newTransaction);
        const t = coins.transaction().deserialize(tx);
        const signedHex = t.sign(theAddress.wif);

        if (signedHex) {
         const response = await btcAPI.broadcastTx(signedHex);

         if (!response.error) {
           centralAddress.active = false;
           centralAddress.balance = platform_fee;
           await centralAddress.save();

           const transactionAttrs = {
             raw_transaction: tx,
             transaction_id: response.tx.hash,
             payment_inputs: newTransaction.paymentInputs,
             payment_outputs: newTransaction.paymentOutputs
           };

           const createdTransaction = await BTCTransactionService.addTransaction(transactionAttrs);
           if (createdTransaction) {
             theAddress.released = true;

             const saved = await theAddress.save();
             if (saved) {
               util.setSuccess(200, 'The coins have been released!', createdTransaction.transaction_id);
               return util.send(res);
             }
           } else {
             throw new Error('Balance has been updated, transaction broadcast, but error saving Transaction to DB...');
           }
         } else {
           let errorMsg = `Error encountered while broadcasting transaction for ${address}`;
           errorMsg += `\n\n Amount: ${total_amount}, signed_hex: ${signedHex} `;
           errorMsg += `\n\n Error Message: ${response.error}`;
           throw new Error(errorMsg)
         }
        } else {
         throw new Error('Error while signing transaction...');
        }
      }

    } catch (error) {
      util.setError(404, error);
      return util.send(res);
    }
  }


  static async validateAddress(req, res) {
    const { address } = req.params


    try {
      const WAValidator = require('wallet-address-validator');

      const valid = WAValidator.validate(address, 'BTC', 'both');

      util.setSuccess(200, `${address} has been validated.`, valid);

      return util.send(res);
    } catch (error) {
      console.log(error);

      util.setError(400, error.message);
      return util.send(res);
    }
  }
}

export default BitcoinAddressController;
