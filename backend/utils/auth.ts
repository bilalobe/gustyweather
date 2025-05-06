import * as admin from 'firebase-admin';
import { KitronikError } from './errorHandling';

export async function verifyDeviceOwnership(userId: string, deviceId: string): Promise<boolean> {
  try {
    const deviceDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('devices')
      .doc(deviceId)
      .get();

    return deviceDoc.exists;
  } catch (error) {
    throw new KitronikError(
      'Failed to verify device ownership',
      'AUTH_ERROR',
      error
    );
  }
}

export async function verifyDataAccess(userId: string, dataPath: string): Promise<boolean> {
  try {
    const snapshot = await admin.database()
      .ref(dataPath)
      .once('value');
    
    const data = snapshot.val();
    return data && data.userId === userId;
  } catch (error) {
    throw new KitronikError(
      'Failed to verify data access',
      'AUTH_ERROR',
      error
    );
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const adminDoc = await admin.firestore()
      .collection('admins')
      .doc(userId)
      .get();
    
    return adminDoc.exists;
  } catch (error) {
    throw new KitronikError(
      'Failed to verify admin status',
      'AUTH_ERROR',
      error
    );
  }
}