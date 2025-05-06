import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { verifyDeviceOwnership, verifyDataAccess, isAdmin } from '../utils/auth';

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceId = req.params.deviceId || req.body.deviceId;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyDeviceOwnership(req.user.uid, deviceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized for this device' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify device access' });
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdminUser = await isAdmin(req.user.uid);
    if (!isAdminUser) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};