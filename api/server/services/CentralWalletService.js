import Sequelize from 'sequelize';
import database from '../src/models/';
import Coinjs from '../../vendor/coin';
import CryptoConversion from '../utils/CryptoConversion';
import BitcoinExternalAPI from '../utils/BitcoinExternalAPI';
import BitcoinAddressService from '../services/BitcoinAddressService';

// TODO: ENSURE BROADCAST ALWAYS WORKS
// TODO: DONT USE ALL UTXOS, CALC THE BLANCE OF AVAILABLE UTXOS AND ONLY USE THOSE NEEDED TO COVER WITHDRAWAL
//  TO AVOID FREEZING WALLET TO ONE TRANSACTION

class CentralWalletService {

  static async withdraw({
    target_address,
    coin_amount,
    coin_type
  }) {
    const loadedAddresses = await this.fetchAddressesWithBalance(coin_amount);

    const externalAPI = new BitcoinExternalAPI(coin_type);

    const addressData = [];

    for (let i = 0; i < loadedAddresses.addresses.length; i++) {
      const addrWithBalance = loadedAddresses.addresses[i];
      const addr = addrWithBalance.address;

      const utXOs = await externalAPI.unspentTXs(addr);

      addressData.push({
        wif: addrWithBalance.wif,
        balance: addrWithBalance.balance,
        address: addr,
        utxos: utXOs
      });
    }

    try {
      let txs = [];
      const miners_fee = await this.getMinersFee(coin_type);
      let amountToRemove = Number((coin_amount + miners_fee).toFixed(8));

      let addedInputTotal = 0.0;
      for (let i = 0; i < addressData.length; i++) {
        const addrData = addressData[i];

        let paymentOutputs = [];
        let paymentInputs = [];
        const balance = addrData.balance;

        if (amountToRemove > 0) {
          if (balance <= amountToRemove) {
            if (balance < miners_fee) continue; // too little to broadcast tx
            let amountToSend = balance - miners_fee;

            if (balance < miners_fee) amountToSend = balance - 0.00001
            paymentOutputs.push({
              address: target_address,
              amount: amountToSend
            });

            // offset amountToRemove by amount added
            amountToRemove = Number((amountToRemove - balance).toFixed(8));
          } else {
            // given address has more than enough for the transaction
            const returnAmount = Number((balance - amountToRemove).toFixed(8));
            let amountToSend = amountToRemove - miners_fee;

            if (amountToSend < miners_fee) {
              amountToSend = Number((amountToRemove - 0.00001).toFixed(8))
            }

            paymentOutputs.push({
              address: target_address,
              amount: amountToSend
            });
            paymentOutputs.push({
              address: addrData.address,
              amount: returnAmount
            });
            amountToRemove = 0;
          }

          if (addrData.utxos.unspents.length == 0) throw new Error('No unspent transactions are currently available in the central wallet.');

          for (let inx = 0; inx < addrData.utxos.unspents.length; inx++) {
            const utXO = addrData.utxos.unspents[inx]
            paymentInputs.push({
              transaction_id: utXO.tx_id,
              transaction_id_n: utXO.tx_n,
              transaction_id_script: utXO.script
            })
          }

          const newTx = await this.broadcastTx(coin_type, paymentInputs, paymentOutputs, addrData.wif);
          txs.push(newTx);
        }
      }

      return txs;
    } catch (error) {
      throw error;
    }
  }

  static async broadcastTx(coinType, paymentInputs, paymentOutputs, wif) {
    const externalAPI = new BitcoinExternalAPI(coinType);

    const coins = Coinjs;

    const testMode = ['development', 'test'].indexOf(process.env.NODE_ENV) >= 0;
    if (testMode) coins.setToTestnet();

    const centralWalletId = await this.fetchCentralWalletId();

    const tx = coins.createTransaction({
      paymentInputs: paymentInputs,
      paymentOutputs: paymentOutputs
    });
    const t = coins.transaction().deserialize(tx);
    const signedHex = t.sign(wif);

    const broadcastedHex = await externalAPI.broadcastTx(signedHex);
    if (broadcastedHex) {
      const newTransaction = {
        raw_transaction: tx,
        transaction_id: broadcastedHex.tx.hash,
        payment_inputs: paymentInputs,
        payment_outputs: paymentOutputs
      };

      return newTransaction;
    } else {
      throw new Error(`Error while attempting to broadcast signed hex: ${signedHex}`);
    }
  }

  static async getMinersFee(coin_type) {
    let miners_fee = 1.50; // USD

    const converter = new CryptoConversion({
      amount: miners_fee,
      from_currency: 'USD',
      to_currency: coin_type
    });

    return await converter.convert();
  }

  static async fetchAddressesWithBalance(targetBalance) {
    const centralWalletId = await this.fetchCentralWalletId();

    let addresses = await database.BitcoinAddress.findAll({
      where: {
        balance: {
          [Sequelize.Op.gt]: 0
        }
      },
      order: [
        ['balance', 'ASC']
      ]
    });

    addresses = await this.updateBalances(addresses);

    let payload = {
      total_balance: 0.0,
      addresses: []
    };

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i];

      payload.total_balance += parseFloat(currentAddress.balance);
      payload.addresses.push(currentAddress);

      if (payload.total_balance >= targetBalance) break;
    }

    return payload;
  }

  static async updateBalances(addresses) {
    let addrs = [];

    for (var i = 0; i < addresses.length; i++) {
      let addr = addresses[i];

      const externalAPI = new BitcoinExternalAPI(addr.coin_type);

      const utXOs = await externalAPI.unspentTXs(addr.address);

      await BitcoinAddressService.updateAddress(addr.id, {
        balance: utXOs.total_amount
      });

      addr = await BitcoinAddressService.getAnAddress(addr.id);
      addrs.push(addr);
    }

    return addrs;
  }



  static async getCentralBalance(coin_type) {
    const centralWalletId = await this.fetchCentralWalletId();

    const activeAddresses = await database.BitcoinAddress.findAll({
      where: {
        active: false,
        coin_type: coin_type,
      }
    })

    let balance = 0.0;

    if (activeAddresses.length > 0) {
      const btcAPI = new BitcoinExternalAPI(coin_type);

      for (let i = 0; i < activeAddresses.length; i++) {
        const currentAddress = activeAddresses[i];

        const addressBalance = await btcAPI.addressBalance(currentAddress.address);

        currentAddress.balance = addressBalance.balance;
        await currentAddress.save();

        balance += addressBalance.balance;
      }
    }

    return balance;
  }


  static async fetchOrCreateCentralBitcoinAddress() {
    const coins = Coinjs;

    const testMode = [
      'development',
      'test'
    ].indexOf(process.env.NODE_ENV) >= 0;

    if (testMode) coins.setToTestnet();

    let newkeys = coins.newKeys(null);
    let sw = coins.bech32Address(newkeys.pubkey);

    const newAddress = {
      active: true,
      central: true,
      wif: newkeys.wif,
      address: newkeys.address,
      public_key: newkeys.pubkey,
      seg_wit_address: sw.address,
      private_key: newkeys.privkey,
      redeem_script: sw.redeemscript
    }

    const createdAddress = await BitcoinAddressService.addAddress(
      newAddress
    );

    return createdAddress;
  }


  static async fetchCentralWalletId() {
    const centralWallet = await this.fetchOrCreateCentralWallet()

    return centralWallet.id;
  }

  static async calculatePlatformFee({
    coin_amount,
    coin_type
  }) {
    let converter = new CryptoConversion({
      amount: coin_amount,
      from_currency: coin_type,
      to_currency: 'USD'
    });

    const usdTotal = await converter.convert();
    const feeInFiat = Number((usdTotal * 0.05).toFixed(2))

    converter = new CryptoConversion({
      amount: feeInFiat,
      from_currency: 'USD',
      to_currency: coin_type
    });

    return await await converter.convert();
  }
}

export default CentralWalletService;
