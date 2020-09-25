import Queue from 'bull';


let DetectBTCDepositsQueue = new Queue('detect_btc_deposits_queue', process.env.REDIS_URL);

const path = require('path');
const processPath = path.resolve('./api/server/queues/processors/BTCDepositSearch.js');
DetectBTCDepositsQueue.process(processPath);

export default DetectBTCDepositsQueue;