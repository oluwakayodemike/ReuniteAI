import express from "express";
import multer from 'multer';
import { reportItem, searchItems, getMatchesForLostItem, startClaimProcess, verifyClaim, getNotifications } from '../controllers/itemController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/items/report', upload.single('itemImage'), reportItem);
router.post('/items/search', upload.single('itemImage'), searchItems);
router.get('/items/matches/:lostItemId', getMatchesForLostItem);
router.post('/items/claim/start', startClaimProcess);
router.post('/items/claim/verify', verifyClaim);
router.get('/notifications', getNotifications);

export default router;