import express from "express";
import multer from 'multer';
import { reportItem, searchItems } from '../controllers/itemController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/items/report', upload.single('itemImage'), reportItem);
router.post('/search', upload.single('itemImage'), searchItems);

export default router;

