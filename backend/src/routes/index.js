import { Router } from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import dataRoutes from './dataRoutes.js';
import storageRoutes from './storageRoutes.js';
import rpcRoutes from './rpcRoutes.js';
import adminRoutes from './adminRoutes.js';
import performanceRoutes from './performanceRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import userRoutes from './userRoutes.js';
import timesheetRoutes from './timesheetRoutes.js';
import requestRoutes from './requestRoutes.js';
import roomBookingRoutes from './roomBookingRoutes.js';
import projectRoutes from './projectRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/room_bookings', roomBookingRoutes);
router.use('/timesheets', timesheetRoutes);
router.use('/users', userRoutes);
router.use('/performance', performanceRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/requests', requestRoutes);
router.use('/profiles', profileRoutes);
router.use('/leaves', leaveRoutes);
router.use('/data', dataRoutes);
router.use('/storage', storageRoutes);
router.use('/rpc', rpcRoutes);
router.use('/admin', adminRoutes);

export default router;
