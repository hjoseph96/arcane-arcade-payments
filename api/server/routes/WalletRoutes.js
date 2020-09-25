import { Router } from 'express';
import WalletController from '../controllers/WalletController';

const router = Router();

router.get('/all', WalletController.getAllWallets);
router.post('/create', WalletController.addWallet);
router.get('/find_by/:user_id', WalletController.getWalletByUserId);
router.get('/:id', WalletController.getWallet);
router.put('/:id', WalletController.updateWallet);
router.delete('/:id', WalletController.deleteWallet);


export default router;
