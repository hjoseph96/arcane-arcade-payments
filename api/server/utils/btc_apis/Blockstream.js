
// BLOCKSTREAM.INFO : SUPPORTS BTC & BTCTEST
// '########::'##::::::::'#######:::'######::'##:::'##::'######::'########:'########::'########::::'###::::'##::::'##:
// ##.... ##: ##:::::::'##.... ##:'##... ##: ##::'##::'##... ##:... ##..:: ##.... ##: ##.....::::'## ##::: ###::'###:
// ##:::: ##: ##::::::: ##:::: ##: ##:::..:: ##:'##::: ##:::..::::: ##:::: ##:::: ##: ##::::::::'##:. ##:: ####'####:
// ########:: ##::::::: ##:::: ##: ##::::::: #####::::. ######::::: ##:::: ########:: ######:::'##:::. ##: ## ### ##:
// ##.... ##: ##::::::: ##:::: ##: ##::::::: ##. ##::::..... ##:::: ##:::: ##.. ##::: ##...:::: #########: ##. #: ##:
// ##:::: ##: ##::::::: ##:::: ##: ##::: ##: ##:. ##::'##::: ##:::: ##:::: ##::. ##:: ##::::::: ##.... ##: ##:.:: ##:
// ########:: ########:. #######::. ######:: ##::. ##:. ######::::: ##:::: ##:::. ##: ########: ##:::: ##: ##:::: ##:
// ........:::........:::.......::::......:::..::::..:::......::::::..:::::..:::::..::........::..:::::..::..:::::..::


import axios from 'axios';
import ParseBTCBalance from '../ParseBTCBalance';

export default class Blockstream {
    constructor(testMode) {
        this.canBroadcast = true;

        this.baseUrl = this.constructBaseURL(testMode);
    }

    constructBaseURL(testing) {
        let url = 'https://blockstream.info';
        if (testing) url += '/testnet';

        url += '/api';

        return url;
    }

    addressBalance(address) {
        const url = `${this.baseUrl}/address/${address}/utxo`;

        const request = axios.get(url).then((res) => {
            const utXOs = res.data.filter(tx => tx.status.confirmed == true);

            const balanceParser = new ParseBTCBalance();
            let balance = 0.0;

            for(let i = 0; i < utXOs.length; i++) {
                const currentUTXO = utXOs[i];
                balance += currentUTXO.value;
            }

            return {  balance: balanceParser.parse(balance) };
        }).catch((error) => {
            throw new Error(error.response.data.error);
        });

        return request;
    }

    async broadcast(signedHex) {
        const url = `${this.baseUrl}/tx`;

        const request = await axios.post(url, signedHex).then((res) => {
            return res.data;
        }).catch((error) => {
            throw new Error(error.response.data);
        });

        return  { tx: { hash: request } };
    }

    getAddress(address) {
        const url = `${this.baseUrl}/address/${address}`;

        const request = axios.get(url).then((res) => {
            return res.data
        }).catch((error) => {
            throw new Error(error);
        });

        return request;
    }

    async getTransaction(transactionId) {
        const url = `${this.baseUrl}/tx/${transactionId}`;

        const request = axios.get(url).then((res) => {
            return res.data
        }).catch((error) => {
            throw new Error(error);
        });

        return request;
    }

    async unspentTXs(address) {
        const url = `${this.baseUrl}/address/${address}/utxo`;

        const request = await axios.get(url).then(async (res) => {
            // confirmed txs only
            let txRefs = res.data.filter(tx => tx.status.confirmed == true) || [];

            // Calc total balance
            let balance = 0.0;
            for(let i = 0; i < txRefs.length; i++) {
                const currentUTXO = txRefs[i];
                balance += currentUTXO.value;
            }

            // compile transaction data
            const context = this;

            const promises = txRefs.map(async (utXO) => {
                const txID = utXO.txid;

                const txData = await context.getTransaction(txID);
                const script = txData.vout[utXO.vout].scriptpubkey;

                return {
                    tx_id:  txID,
                    tx_n:   utXO.vout,
                    script: script
                };
            });
            txRefs = await Promise.all(promises);

            const balanceParser = new ParseBTCBalance();

            return { unspents: txRefs, total_amount: balanceParser.parse(balance) };
        }).catch((error) => {
            console.log(error)
            throw new Error(error);
        });

        return request;
    }
}
