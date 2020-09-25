import WalletService from '../services/WalletService';
import Util from '../utils/Utils';

const util = new Util();

class WalletController {
  static async getAllWallets(req, res) {
    try {
      const allWallets = await WalletService.getAllWallets();
      if (allWallets.length > 0) {
        util.setSuccess(200, 'Wallets retrieved', allWallets);
      } else {
        util.setSuccess(200, 'No Wallet found');
      }
      return util.send(res);
    } catch (error) {
      util.setError(400, error);
      return util.send(res);
    }
  }

  static async addWallet(req, res) {
    let newWallet = req.body;

    if (newWallet.user_id == 'null') newWallet.user_id = null;

    try {
      const createdWallet = await WalletService.addWallet(newWallet);

      util.setSuccess(201, 'Wallet Added!', createdWallet);

      return util.send(res);
    } catch (error) {
      console.log(error);

      util.setError(400, error.message);

      return util.send(res);
    }
  }

  static async updateWallet(req, res) {
    const alteredWallet = req.body;
    const { id } = req.params;

    if (!String(id)) {
      util.setError(400, 'Please input a valid uuid value');
      return util.send(res);
    }

    if (alteredWallet.btc_balance)
      alteredWallet.btc_balance = parseFloat(alteredWallet.btc_balance);
    if (alteredWallet.ltc_balance)
      alteredWallet.ltc_balance = parseFloat(alteredWallet.ltc_balance);
    if (alteredWallet.xmr_balance)
      alteredWallet.xmr_balance = parseFloat(alteredWallet.xmr_balance);

    try {
      const updateWallet = await WalletService.updateWallet(id, alteredWallet);
      if (!updateWallet) {
        util.setError(404, `Cannot find Wallet with the id: ${id}`);
      } else {
        util.setSuccess(200, 'Wallet updated', updateWallet);
      }
      return util.send(res);
    } catch (error) {
      console.log(error);
      util.setError(404, error);
      return util.send(res);
    }
  }

  static async getWallet(req, res) {
    const { id } = req.params;

    if (!String(id)) {
      util.setError(400, 'Please input a valid uuid value');
      return util.send(res);
    }

    try {
      const theWallet = await WalletService.getWallet(id);

      if (!theWallet) {
        console.log(`Cannot find Wallet with the id: ${id}`);
        util.setError(404, `Cannot find Wallet with the id: ${id}`);
      } else {
        util.setSuccess(200, 'Found Wallet', theWallet);
      }

      return util.send(res);
    } catch (error) {
      console.log(error);

      util.setError(404, error);
      return util.send(res);
    }
  }

  static async deleteWallet(req, res) {
    const { id } = req.params;

    if (!Number(id)) {
      util.setError(400, 'Please provide a numeric value');
      return util.send(res);
    }

    try {
      const walletToDelete = await WalletService.deleteWallet(id);

      if (walletToDelete) {
        util.setSuccess(200, 'Wallet deleted');
      } else {
        util.setError(404, `Wallet with the id: ${id} cannot be found`);
      }

      return util.send(res);
    } catch (error) {
      util.setError(400, error);
      return util.send(res);
    }
  }

  static async getWalletByUserId(req, res) {
    let { user_id } = req.params;

    if (user_id == 'null') user_id = null
    try {
      const theWallet = await WalletService.findByUserId(user_id);

      if (!theWallet) {
        util.setError(404, `Cannot find Wallet with the user_id ${user_id}`);
      } else {
        util.setSuccess(200, 'Found Wallet', theWallet);
      }

      return util.send(res);
    } catch (error) {
      console.log(error);
      util.setError(404, error);
      return util.send(res);
    }
  }
}

export default WalletController;
