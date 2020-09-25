import axios from 'axios';

export default class ChainSo {
    constructor(testMode, coinType) {
        this.canBroadcast = true;
        this.baseUrl = 'https://chain.so/api/v2';
        this.network = this.setNetwork(testMode, coinType);
    }

    setNetwork(coinType, testMode) {
        switch(coinType) {
            case 'BTC':
                return testMode ? 'BTCTEST' : 'BTC';
            case 'LTC':
                return testMode ? 'LTCTEST' : 'LTC';
            default:
                throw new Error('Invalid coinType defined. Must be "BTC" or "LTC"');
        }
    }

    processRequest(response) {
        if (typeof response !== 'object') throw new Error('API has returned HTML... Likely CloudFlare fucking with you.');

        if (response.data.network == this.network) {
            return response;
        } else if (response.status == 'fail') {
            return response.data;
        }
    }

    broadcast(signedHex) {
        const url = `${this.baseUrl}/send_tx/${this.network}`;

        const request = axios.post(url, { tx_hex: signedHex }).then((res) => {
            return processRequest(res);
        });

        return request;
    }

    getTransaction(txId) {
        const url = `${this.baseUrl}/get_tx/${this.network}/${txId}`;

        const request = axios.get(url).then((res) => {
            return this.processRequest(res);
        });

        return request;
    }

    async unspentTXs(address, afterTxId) {
        afterTxId = afterTxId || null;

        const url = `${this.baseUrl}/get_tx_unspent/LTCTEST/${address}/`;
        
        if (afterTxId) url += afterTxId;

        const request = axios.get(url).then((res) => {
            return this.processRequest(res);
        });

        return request;
    }

    addressBalance(address, minimumConfirmation) {
        minimumConfirmation = minimumConfirmation || null;

        const url = `${this.baseUrl}/get_address_balance/${this.network}/${address}[/`;

        if (minimumConfirmation) url += minimumConfirmation;

        const request = axios.get(url).then((res) => {
            return this.processRequest(res);
        });

        return request;
    }
}