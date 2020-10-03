import Util from '../utils/Utils';
import MoneroService from '../services/MoneroService'
import DetectMoneroDepositsQueue from '../queues/DetectMoneroDeposits'
import MoneroAddressService from '../services/MoneroAddressService';
import CentralWalletService from '../services/CentralWalletService';

const util = new Util();

export default class MoneroController {

    static async createAddress(req, res) {
        const { deposit_amount, expires_at } = req.body;

        if (!Number(deposit_amount), !Date(expires_at)) {
            util.setError(400, 'Provide complete details to generate a new Monero address.');

            return util.send(res);
        }

       try {
          const newAddress = await MoneroService.createAddress({
            expires_at: expires_at,
            deposit_amount: deposit_amount
          });

          util.setSuccess(200, 'Created a new Monero Address.', newAddress);

          return util.send(res);
       } catch (e) {
           console.log(e);

           util.setError(400, e);
           return util.send(res);
       }
    }


    static async createWithdrawal(req, res) {
      const { destination, xmr_amount } = req.body;

      if (!String(destination), !Number(xmr_amount)) {
        const error = 'Provide complete details to withdraw Monero.';

        util.setError(400, error);
        return util.send(res);
      }

      try {
        const tx = await MoneroService.sendTx(destination, xmr_amount);

        if (tx) {
          const success = `Sent ${xmr_amount} XMR to ${destination}`;
          util.setSuccess(200, success, tx.state.id);

          return util.send(res);
        }
      } catch (e) {
        console.log(e);

        util.setError(400, e);
        return util.send(res);
      }
    }


    static async findByAddress(req, res) {
      const { address } = req.params;

      if (!String(address)) {
        util.setError(400, 'Please input a valid XMR address');
        return util.send(res);
      }

      try {
        const theAddress = await MoneroAddressService.findByAddress(address);

        if (!theAddress) {
          util.setError(404, `Cannot find XMR Address: ${address}`);
        } else {
          util.setSuccess(200, 'Found XMR Address', theAddress);
        }

        return util.send(res);
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
        util.setError(400, 'Please input a valid XMR address');
        return util.send(res);
      }

      try {
        const theAddress = await MoneroAddressService.findByAddress(address);

        if (!theAddress) {
          util.setError(404, `Cannot find XMR Address: ${address}`);
        } else {
          const balanceAsXMR = parseInt(theAddress.balance) / 1000000000000;
          let platform_fee = await CentralWalletService.calculatePlatformFee({
            coin_amount: balanceAsXMR,
            coin_type: 'XMR'
          });

          const xmr_amount = Number(
            theAddress.balance) - Number((platform_fee * 1000000000000).toFixed()
          );

          const tx = await MoneroService.sendTx(destination, xmr_amount);

          theAddress.released = true;
          if (tx && theAddress.save()) {
            const success = `Sent ${xmr_amount} XMR to ${destination}`;
            util.setSuccess(200, success, tx.state.id);

            return util.send(res);
          }
        }
      } catch (error) {
        console.log(error);

        util.setError(404, error);
        return util.send(res);
      }
    }


    static async validateAddress(req, res) {
      const { address } = req.params


      try {
        const WAValidator = require('wallet-address-validator');

        const valid = WAValidator.validate(address, 'XMR', 'both');

        util.setSuccess(200, `${address} has been validated.`, valid);
        return util.send(res);
      } catch (error) {
        console.log(error);

        util.setError(400, error.message);
        return util.send(res);
      }
    }
}
