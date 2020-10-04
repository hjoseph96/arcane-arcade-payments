import database from '../src/models/';

class WalletService {
  static async getAllWallets() {
    try {
      return await database.Wallet.findAll();
    } catch (error) {
      throw error;
    }
  }

  static async addWallet(newWallet) {
    try {
      return await database.Wallet.create(newWallet);
    } catch (error) {
      throw error;
    }
  }

  static async updateWallet(id, updateWallet) {
    try {
      const WalletToUpdate = await database.Wallet.findOne({
        where: { id: String(id) }
      });

      if (WalletToUpdate) {
        await database.Wallet.update(updateWallet, { where: { id: String(id) } });

        return updateWallet;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  static async getWallet(id) {
    try {
      const theWallet = await database.Wallet.findOne({
        where: { id: String(id) },
        include: [
          {
            model: database.BitcoinAddress,
            attributes: ['id', 'active', 'address'],
          },
          {
            model: database.BTCTransaction,
            attributes: ['id', 'payment_outputs', 'payment_inputs', 'raw_transaction']
          },
          {
            model: database.XMRTransaction,
            attributes: ['tx_id', 'amount', 'fee', 'confirmations']
          },
          {
            model: database.MoneroAddress,
            attributes: ['address', 'active']
          }
        ]
      });

      return theWallet;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  static async deleteWallet(id) {
    try {
      const WalletToDelete = await database.Wallet.findOne({ where: { id: String(id) } });

      if (WalletToDelete) {
        const deletedWallet = await database.Wallet.destroy({
          where: { id: Number(id) },
          include: [
            {
              model: database.BitcoinAddress,
              attributes: ['id', 'seg_wit_address', 'active', 'address', 'wif'],
            },
            {
              model: database.BTCTransaction,
              attributes: ['id', 'payment_outputs', 'payment_inputs', 'raw_transaction']
            }
          ]
        });
        return deletedWallet;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(user_id) {
    try {
      const theWallet = await database.Wallet.findOne({
        where: { user_id: user_id },
        include: [
          {
            model: database.BitcoinAddress,
            attributes: ['id', 'seg_wit_address', 'active', 'address', 'wif'],
          },
          {
            model: database.BTCTransaction,
            attributes: ['id', 'payment_outputs', 'payment_inputs', 'raw_transaction']
          }
        ]
      });

      if (theWallet) return theWallet;

      return null;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export default WalletService;
