// =======================================
//  _               _                     |
// |_) |  _   _ |  /     ._  |_   _  ._   |
// |_) | (_) (_ |< \_ \/ |_) | | (/_ |    |
//                    /  |                |
//========================================

import axios from 'axios';
import ParseBTCBalance from '../ParseBTCBalance';

export default class BlockCypher {
    constructor(coinType, testMode) {
        this.canBroadcast = true;
        this.networkPath = this.setNetworkPath(coinType, testMode);
        this.baseUrl = `https://api.blockcypher.com/v1/${this.networkPath}`;
    }

    setNetworkPath(coinType, testMode) {
        switch (coinType) {
            case 'BTC':
                return testMode ? 'btc/test3' : 'btc/main';
            case 'LTC':
                if (testMode) {
                    throw new Error('No support for Litecoin Testnet on BlockCypher');
                } else {
                    return 'ltc/main/';
                }
            default:
                throw new Error('Invalid coinType given to BlockCypher. Must be BTC or LTC.');
        }
    }

    addressBalance(address) {
        const url = `${this.baseUrl}/addrs/${address}/balance?token=${process.env.BLOCKCYPHER}`;

        const request = axios.get(url).then((res) => {
            const balanceParser = new ParseBTCBalance();

            const payload = {
                balance: balanceParser.parse(res.data.balance),
                unconfirmed_balance: balanceParser.parse(res.data.unconfirmed_balance)
            };

            return payload;
        }).catch((error) => {
            throw new Error(error.response.data.error);
        });

        return request;
    }

    broadcast(signedHex) {
        const url = `${this.baseUrl}/txs/push?token=${process.env.BLOCKCYPHER}`;

        const request = axios.post(url, { tx: signedHex }).then((res) => {
            return { hash: res.data };
        }).catch((error) => {
            throw new Error(error.response.data.error);
        });

        return request;
    }

    getAddress(address) {
        const url = `${this.baseUrl}/addrs/${address}?token=${process.env.BLOCKCYPHER}`;

        const request = axios.get(url).then((res) => {
            return res.data
        }).catch((error) => {
            throw new Error(error);
        });

        return request;
    }

    getTransaction(transaction) {
        const url = `${this.baseUrl}/txs/${transaction}?token=${process.env.BLOCKCYPHER}`;

        const request = axios.get(url).then((res) => {
            return res.data
        }).catch((error) => {
            throw new Error(error);
        });

        return request;
    }

    async unspentTXs(address) {
        const url = `${this.baseUrl}/addrs/${address}?unspentOnly=true&includeScript=true&token=${process.env.BLOCKCYPHER}`;

        const request = axios.get(url).then((res) => {
            let txRefs = res.data.txrefs || [];
            txRefs =txRefs.map((utXO) => {
                return {
                    tx_id:  utXO.tx_hash,
                    tx_n:   utXO.tx_output_n,
                    script: utXO.script
                };
            });

            const balanceParser = new ParseBTCBalance();
            const balance = balanceParser.parse(res.data.final_balance);

            const payload = { unspents: txRefs,  total_amount: balance };

            return payload;
        }).catch((error) => {
            throw new Error(error);
        });

        return request;
    }
}