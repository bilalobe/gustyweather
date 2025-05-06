import { Request, Response, NextFunction } from 'express';
import admin from '../utils/firebase';
import { AuthenticatedRequest } from './auth.middleware';

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  userId: string;
  lastActive: number;
  status: 'active' | 'inactive' | 'disabled';
}

export interface DeviceRequest extends AuthenticatedRequest {
  deviceInfo?: DeviceInfo;
}

export const validateDevice = async (
  req: DeviceRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(401).json({ error: 'Missing device token' });
    }

    // Verify device exists and is active
    const deviceDoc = await admin.firestore()
      .collection('devices')
      .doc(deviceToken)
      .get();

    if (!deviceDoc.exists) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    const deviceInfo = deviceDoc.data() as DeviceInfo;

    // Verify device belongs to authenticated user
    if (req.user?.uid !== deviceInfo.userId) {
      return res.status(403).json({ error: 'Device not authorized for this user' });
    }

    // Verify device is active
    if (deviceInfo.status !== 'active') {
      return res.status(403).json({ error: 'Device is not active' });
    }

    // Update last active timestamp
    await deviceDoc.ref.update({
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    req.deviceInfo = deviceInfo;
    next();
  } catch (error) {
    console.error('Device validation error:', error);
    res.status(500).json({ error: 'Device validation failed' });
  }
};