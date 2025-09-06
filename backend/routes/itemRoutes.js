import express from "express";
import multer from 'multer';
import { reportItem, searchItems, getMatchesForLostItem, startClaimProcess, verifyClaim, getNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/itemController.js';
import { getDashboardData, getLostReports, getFoundReports } from '../controllers/dashboardController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/items/report', upload.single('itemImage'), reportItem);
router.post('/items/search', upload.single('itemImage'), searchItems);
router.get('/items/matches/:lostItemId', getMatchesForLostItem);
router.post('/items/claim/start', startClaimProcess);
router.post('/items/claim/verify', verifyClaim);
router.get('/notifications', getNotifications);
router.post('/notifications/mark-read', markNotificationRead);
router.post('/notifications/mark-all-read', markAllNotificationsRead);

router.get('/dashboard', getDashboardData);
router.get('/dashboard/lost-reports', getLostReports);
router.get('/dashboard/found-reports', getFoundReports);

export default router;