import { Router } from 'express';
import PGPController from '../controllers/PGPController';

const router = Router();

router.post('/encrypt', PGPController.encryptMessage);
router.post('/decrypt', PGPController.decryptMessage);
router.post('/generate_chat_keys', PGPController.generateChatKeys);



export default router;
