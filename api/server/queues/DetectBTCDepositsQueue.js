import Queue from 'bull';

// import database from '../src/models';
// import BitcoinExternalAPI from '../utils/BitcoinExternalAPI'
// import Coinjs from '../../vendor/coin';
// import CryptoConversion from '../utils/CryptoConversion';
// import BTCTransactionService from '../services/BTCTransactionService';
// import BitcoinAddressService from '../services/BitcoinAddressService';
// import CentralWalletService from '../services/CentralWalletService';


let DetectBTCDepositsQueue = new Queue('detect_btc_deposits_queue', process.env.REDIS_URL);

const path = require('path');
const processPath = path.resolve('./api/server/queues/processors/BTCDepositSearch.js');
DetectBTCDepositsQueue.process(processPath);

export default DetectBTCDepositsQueue;
