import XMRTransactionService from '../services/XMRTransactionService';
import MoneroAddressService from '../services/MoneroAddressService';

require('dotenv').config();


class MoneroService {
    static async walletRPC() {
        const MoneroWalletRpc = require('../../../node_modules/monero-javascript/src/main/js/wallet/MoneroWalletRpc');

        let walletRpc = new MoneroWalletRpc(`http://localhost:${process.env.RPC_PORT}`, process.env.RPC_USER, process.env.RPC_PASSWORD);

        return walletRpc;
    }

    static async daemon() {
        const MoneroDaemonRpc = require('../../../node_modules/monero-javascript/src/main/js/daemon/MoneroDaemonRpc');

        let daemon = new MoneroDaemonRpc(`http://localhost:${process.env.DAEMON_PORT}`);
        return daemon;
    }

    static async rescanBlockchain() {
      const walletRPC  = await this.walletRPC();

      await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
      await walletRPC.sync(1);

      console.log('***** XMR BLOCKCHAIN UPDATED *****');

      await walletRPC.close(true);
    }

    static async createAddress({  deposit_amount, destination_address, expires_at }) {
        const walletRPC  = await this.walletRPC();

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.rescanSpent();

        const subAddress =  await walletRPC.createSubaddress();

        await walletRPC.close(true);

        const newAddress = await MoneroAddressService.addAddress({
            deposit_amount: deposit_amount,
            destination_address: destination_address,
            balance: subAddress.state.balance,
            address: subAddress.state.address,
            expires_at: Date.parse(expires_at),
            subaddressIndex: subAddress.state.index
        });

        console.log('Created XMR Address');

        return newAddress;
    }

    static async getUnspents(subaddressIndex) {
        const walletRPC  = await this.walletRPC();

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.sync();
        await walletRPC.rescanSpent();

        const subAddresses  = await walletRPC.getSubaddresses();
        const target = subAddresses[subaddressIndex];

        let utXOs = [];

        if (target) {
            let txs = await walletRPC.getOutputs({
                isLocked: false,
                outputQuery: {
                  isSpent: false,
                },
            });

            utXOs = txs.filter(function(o) {
                return o.state.subaddressIndex == subaddressIndex
            });
        }

        await walletRPC.close();

        return utXOs;
    }

    static async getBalance(subaddressIndex) {
        const walletRPC  = await this.walletRPC();

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.sync();
        await walletRPC.rescanSpent();

        const unconfirmedBalance    = await walletRPC.getBalance(0, subaddressIndex);
        const unlockedBalance       = await walletRPC.getUnlockedBalance(0, subaddressIndex);

        console.log(`Unconfirmed: ${unconfirmedBalance} | Available: ${unlockedBalance}`);

        await walletRPC.close();

        return unlockedBalance;
    }

    static async sendToPrimary(subaddressIndex, amount) {
        const walletRPC  = await this.walletRPC()
        await walletRPC.close();

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.rescanSpent();


        const accounts          = await walletRPC.getAccounts(true);
        const accountIndex      = accounts[0].state.index;

        const primaryAddress    = accounts[0].state.primaryAddress


        amount = new BigInteger(amount);
        // ensure subaddress has enough balance
        const request = new MoneroSendRequest()
            .setAccountIndex(accountIndex)
            .setSubaddressIndices([accountIndex, subaddressIndex])
            .setPriority(MoneroSendPriority.ELEVATED)
            .setDestinations([
                 new MoneroDestination(primaryAddress, amount)
            ]);

        const createdTx = (await walletRPC.createTx(request)).getTxs()[0];

        await walletRPC.relayTx(createdTx);
        await walletRPC.close();

        return await this.saveTransaction(subaddressIndex, createdTx, amount);
    }

    static async sendTx(destinationAddress, amount) {
        const walletRPC     = await this.walletRPC()

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.rescanSpent();


        let tx = await walletRPC.createTx({
          accountIndex: 0,  // source account to send funds from
          address: destinationAddress,
          amount: amount, // send 1 XMR (denominated in atomic units)
          relay: true // relay the transaction to the network
        });
        await walletRPC.close();

        return tx;
    }

    static async saveTransaction(subaddressIndex, createdTx, amount, destination) {
        destination = destination || null;

        const subAddress = await MoneroAddressService.findAddressBySubaddressIndex(subaddressIndex);
        const fee = createdTx.getFee();

        const savedTransaction = await XMRTransactionService.addTransaction({
            fee: fee,
            valid: false,
            amount: amount,
            key: createdTx.state.key,
            destination: destination,
            tx_id: createdTx.state.id,
            monero_address_id: subAddress.id,
            full_hex: createdTx.state.fullHex,
            metadata: createdTx.state.metadata,
            confirmations: createdTx.state.numConfirmations
        });

        return savedTransaction;
    }

    static async seedSubAddresses() {
        const walletRPC     = await this.walletRPC()

        await walletRPC.openWallet(process.env.WALLET_FILENAME, process.env.WALLET_PASS);
        await walletRPC.rescanSpent();


        const accounts      = await walletRPC.getAccounts(true);
        const subAddresses  = accounts[0].state.subaddresses

        const savedAddresses = subAddresses.map(async (subAddress) => {
            return await MoneroAddressService.addAddress({
                active: true,
                address: subAddress.state.address,
                balance: subAddress.state.balance,
                subaddressIndex: subAddress.state.index,
            })
        })

        return walletRPC.close();
    }
}
export default MoneroService;
