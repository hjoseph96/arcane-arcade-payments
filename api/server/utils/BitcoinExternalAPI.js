require('dotenv').config();

import ChainSo from './btc_apis/ChainSo';
import Blockchain from './btc_apis/Blockchain';
import BlockCypher from './btc_apis/BlockCypher';
import Blockstream from './btc_apis/Blockstream';


export default class BitcoinExternalAPI {
    constructor(coinType) {
        this.coinType = coinType;
        this.testMode = this.setTestMode();

        this.providers = {
            blockcypher: new BlockCypher(this.coinType, this.testMode),
            chainsSo: new ChainSo(this.coinType, this.testMode),
            blockstream: new Blockstream(this.testMode),
            blockchain: new Blockchain(this.testMode)
        };

        this.providerList = ['blockstream', 'blockcypher', 'chainSo'];

        if (this.coinType == 'LTC') {
            delete this.providers.blockchain;
            delete this.providers.blockstream;

            if (this.testMode) delete this.providers.blockcypher;
        } else if (this.coinType == 'BTC') {
            console.log(this.providerList);
        } else {
            throw new Error('Unsupported coinType given. Must be BTC or LTC.');
        }

        this.selectedProvider = this.providerList[0];
        this.currentProvider = this.providers[this.selectedProvider];
    }

    setTestMode() {
        const deployEnv =  process.env.NODE_ENV ? process.env.NODE_ENV : 'development';

        return (['development', 'test'].indexOf(deployEnv) >= 0) ? true : false;
    }

    setNextProvider() {
        const targetIndex = this.providerList.indexOf(this.selectedProvider) + 1;

        if (targetIndex < 0) throw new Error('Somehow specified unsupported API provider'); 
        if (targetIndex > (this.providerList.length - 1)) {
            const error_msg = `Only ${this.providerList.length} providers supported, you are looking for a ${targetIndex+1}th one.`;
            throw new Error(error_msg)
        }

        this.selectedProvider =  this.providers[this.providerList[targetIndex]];
    }

    getTransaction(txId) {   
        let transaction;

        try {
            transaction = this.currentProvider.getTransaction(txId);
        } catch (error) {
            console.log(error);

            console.log(`${this.selectedProvider} API has failed on getTransaction. Trying tthe next provider...`);

            try {
                this.setNextProvider();
                transaction = this.currentProvider.getTransaction(txId);
            } catch (error) {
                console.log(error);

                console.log(`${this.selectedProvider} API has failed on getTransaction. Trying tthe next provider...`);


                try {
                    this.setNextProvider();
                    transaction = this.currentProvider.getTransaction(txId);
                } catch (error) {
                    console.log(`${this.selectedProvider} API has failed on getTransaction. No other prooviders left to try.`);

                    throw error;
                }
            }
        }

        return transaction;
    }

    async broadcastTx(signedHex) {
        let broadcast;

        try {
            broadcast =  await this.currentProvider.broadcast(signedHex);
        } catch {
            console.log(`${this.selectedProvider} API has failed on broadcastTx. Trying the next provider...`);

            try {
                this.setNextProvider();
                
                if (!this.currentProvider.canBroadcast) this.setNextProvider();
                
                broadcast = await this.currentProvider.broadcast(signedHex);
            } catch (error) {
                console.log(`${this.selectedProvider} API has failed on broadcastTx. Trying the next provider...`);

                throw error;
            }
        }

        return broadcast;
    }

    getAddress(address) {
        let addr;  

        try {
            addr = this.currentProvider.getAddress(address);
        } catch {
            console.log(`${this.selectedProvider} API has failed on getAddress Trying the next provider...`);

            try {
                this.setNextProvider();
                addr = this.currentProvider.getAddress(address);
            } catch {
                console.log(`${this.selectedProvider} API has failed on getAddress. Trying the next provider...`);

                try {
                    this.setNextProvider();
                    addr = this.currentProvider.getAddress(address);
                } catch (error) {
                    console.log(`${this.selectedProvider} API has failed on getAddress. No other prooviders left to try.`);

                    throw error;
                }
            }
        }

        return addr;
    }

    addressBalance(address) {
        let balance;
        
        try {
            balance = this.currentProvider.addressBalance(address);
        } catch {
            console.log(`${this.selectedProvider} API has failed on addressBalance. Trying tthe next provider...`);

            try {
                this.setNextProvider();
                balance = this.currentProvider.addressBalance(address);
            } catch {
                console.log(`${this.selectedProvider} API has failed on addressBalance. Trying tthe next provider...`);

                try {
                    this.setNextProvider();
                    balance = this.currentProvider.addressBalance(address);
                } catch (error) {
                    console.log(`${this.selectedProvider} API has failed on addressBalance. No other prooviders left to try.`);

                    throw error;
                }
            }
        }

        return balance;
    }

    async unspentTXs(address) {
        let utXOs;

        try {
            utXOs = await this.currentProvider.unspentTXs(address);
        } catch(error) {
            console.log(error);
            console.log(`${this.selectedProvider} API has failed on unspentTXs. Trying tthe next provider...`);

            try {
                this.setNextProvider();
                utXOs = this.currentProvider.unspentTXs(address);
            } catch(error) {
                console.log(error);
                console.log(`${this.selectedProvider} API has failed on unspentTXs. Trying tthe next provider...`);

                try {
                    this.setNextProvider();
                    utXOs = this.currentProvider.unspentTXs(address);
                } catch (error) {
                    console.log(`${this.selectedProvider} API has failed on unspentTXs. No other prooviders left to try.`);

                    throw error;
                }
            }
        }

        return utXOs;
    }

}