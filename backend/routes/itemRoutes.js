import express from "express";
import multer from 'multer';
import { reportItem, searchItems, startClaimProcess, verifyClaim } from '../controllers/itemController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/items/report', upload.single('itemImage'), reportItem);
router.post('/items/search', upload.single('itemImage'), searchItems);
router.post('/items/claim/start', startClaimProcess);
router.post('/items/claim/verify', verifyClaim);

export default router;
