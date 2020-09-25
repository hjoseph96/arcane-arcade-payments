import axios from 'axios';
import ParseBTCBalance from '../ParseBTCBalance';

export default class Blockchain {
    constructor(testMode) {
        this.testMode = testMode;
        this.canBroadcast = false;
        this.baseUrl = this.setBaseUrl();
    }

    setBaseUrl() {
        if (this.testMode) {
            return 'https://testnet.blockchain.info';
        } else {
            return 'https://blockchain.info';
        }    
    }

    getTransaction(tx_id) {
        const url = `${this.baseUrl}/rawtx/${tx_id}`;
        
        const response = axios.get(url).then((res) => {
            if (response.hash) {
                return res;
            } else {
                throw new Error(res);
            }
        });
        
        return response;
    }

    getAddress(address) {
        const url = `${this.baseUrl}/rawaddr/${address}`;
        
        const response = axios.get(url).then((res) => {
            if (res.address) {
                return res
            } else {
                throw new Error(res);
            }
        });
        
        return response;
    }

    async unspentTXs(address) {
        const url = `${this.baseUrl}/unspent?active=${address}`;
        
        const response = axios.get(url).then((res) => {
            if (res.data.address) {
                return res;
            } else {
                throw new Error(res);
            }
        });
        
        return response;
    }

    addressBalance(address) {
        const url = `${this.baseUrl}/unspent?active=${address}`;

        const response = axios.get(url).then((res) => {
            const balanceParser = new ParseBTCBalance();

            if (res[address]) {
                return balanceParser.parse(res[address].final_balance);
            } else {
                throw new Error(res);
            }
        });
        
        return response;
    }
}