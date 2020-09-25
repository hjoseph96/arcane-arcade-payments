// ======================================================
// 
//  FUCKING SLOW. KEEPING THIS, BUT FUCKING SLOW ASFFFFF.
// 
// ======================================================
require('dotenv').config();

const bitcoind = require('bitcoin-core');

const env = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';

export default class BitcoinRPC {
    constructor() {
        this.network = this.setBitcoinNetwork(env);
        this.port = this.setBitcoinPort(env);
        this.client = new bitcoind({
            port: this.port,            
            network: this.network,
            username: process.env.RPC_USER,
            password: process.env.RPC_PASSWORD,
        })
    }

    setBitcoinNetwork(deployEnv) {
        if (['development', 'test'].indexOf(deployEnv) >= 0) {
            return 'regtest';
        } else {
            return 'mainnet';
        }
    }

    setBitcoinPort(deployEnv) {
        if (['development', 'test'].indexOf(deployEnv) >= 0) {
            return 18332;
        } else {
            return 8332;
        }
    }

   async addressBalance(btcAddress) {
        const balance = await this.client.command('scantxoutset', 'start', [`addr(${btcAddress})`])
            .then((response) => {
                return response.total_amount
            })
            .catch((error) => {
                console.log(error);
                throw error;
            });

        return balance;
    }

    async getUpsentTxs(btcAddress) {
        const txs = await this.client.command('scantxoutset', 'start', [`addr(${btcAddress})`])
            .then((response) => {
                return { unspents: response.unspents, total_amount: response.total_amount }
            })
            .catch((error) => {
                console.log(error);
                throw error;
            });
        
        return txs;
    }

    async broadcastTx(signed_hex) {
        const newTransactionId = await this.client.command('sendRawTransaction', signed_hex, false).then((response) => {
            return response.hex
        }).catch((error) => {
            throw error;
        })
        
        return newTransactionId;
    }
}