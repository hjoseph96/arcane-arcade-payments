import { Router } from 'express';
import MoneroController from '../controllers/MoneroController';

const router = Router();

router.get('/find_by/:address', MoneroController.findByAddress);
router.post('/create', MoneroController.createAddress);
router.post('/withdraw', MoneroController.createWithdrawal);
router.post('/release_funds/:address', MoneroController.releaseFunds);
router.get('/validate/:address', MoneroController.validateAddress);

export default router;
