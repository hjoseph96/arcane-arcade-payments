import { Router } from 'express';
import BitcoinAddressController from '../controllers/BitcoinAddressController';

const router = Router();

router.post('/create', BitcoinAddressController.addAddress);
router.get('/address_balance/:coin_type/:address', BitcoinAddressController.addressBalance)
router.get('/central_balance/:coin_type', BitcoinAddressController.centralBalance)
router.get('/find_by/:address', BitcoinAddressController.findByAddress);
router.post('/release_funds/:address', BitcoinAddressController.releaseFunds);
router.get('/validate/:address', BitcoinAddressController.validateAddress);

export default router;
