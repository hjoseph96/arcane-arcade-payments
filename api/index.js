import config from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

import bitcoinRoutes from './server/routes/BitcoinAddressRoutes';
import BTCTransactionRoutes from './server/routes/BTCTransactionRoutes';
import pgpRoutes from './server/routes/PGPRoutes';
import moneroRoutes from './server/routes/MoneroRoutes';


import DetectBTCDepositsQueue from './server/queues/DetectBTCDepositsQueue'
import DetectMoneroDepositsQueue from './server/queues/DetectMoneroDeposits'

config.config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = process.env.PORT || 8000;// when a random route is inputed

const Arena = require('bull-arena');

const request = require('request');
const fs = require('fs');
const macaroon = fs.readFileSync(`${process.env.LN_DIR}/admin.macaroon`).toString('hex');


// const redisUrl = process.env.REDIS_URL;
// const Bee = require('bee-queue');
// const arena = Arena({
//    Bee,
//    queues: [
//       {
//          name: 'detect_btc_deposits_queue',
//          hostId: 'Bitcoin Deposit Scanner',
//          url: redisUrl
//       },
//       {
//         name: 'detect_monero_deposits_queue',
//         hostId: 'Monero Deposit Scanner',
//         url: redisUrl
//       }
//    ]
// }, { port: port, disableListen : true });

app.use('/api/v1/pgp', pgpRoutes);
app.use('/api/v1/xmr', moneroRoutes);
app.use('/api/v1/btc', bitcoinRoutes);
app.use('/api/v1/btc_transactions', BTCTransactionRoutes);

// app.use('/arena', arena);

app.get('*', (req, res) => res.status(200).send({
  message: 'Welcome to this API.'
}));


app.listen(port, () => {
  console.log(`Server is running on PORT ${port}`);
});

// Queue Coin Deposits Search
DetectBTCDepositsQueue.empty();
DetectBTCDepositsQueue.add(
  { env: process.env.NODE_ENV },
  {
    repeat: { every: 15000 },
    removeOnComplete: false,
    removeOnFail: false
  }
);

DetectMoneroDepositsQueue.empty();
DetectMoneroDepositsQueue.add(
  { env: process.env.NODE_ENV }, 
  {
    repeat: { every: 15000 },
    removeOnComplete: false,
    removeOnFail: false 
  }
);


export default app;
