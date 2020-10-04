import { Router } from 'express';
import BTCTransactionController from '../controllers/BTCTransactionController';

const router = Router();

router.get('/all', BTCTransactionController.getAllTransactions);
router.post('/create', BTCTransactionController.addTransaction);
router.get('/:id', BTCTransactionController.getTransaction);
router.get('/status/:tx_id', BTCTransactionController.fetchStatus);
router.post('/broadcast', BTCTransactionController.broadcastTx);
router.post('/withdraw', BTCTransactionController.createWithdrawal);
router.post('/:id/sign', BTCTransactionController.signTransaction);


export default router;
