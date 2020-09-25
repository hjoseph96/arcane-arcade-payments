import Queue from 'bull';

let DetectMoneroDepositsQueue = new Queue('detect_monero_deposits_queue', process.env.REDIS_URL);

const path = require('path');
const processPath = path.resolve('./api/server/queues/processors/XMRDepositSearch.js');
DetectMoneroDepositsQueue.process(processPath);

export default DetectMoneroDepositsQueue;
