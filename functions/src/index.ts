/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Handle device registration
export const registerDevice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const { name, type = 'kitronik' } = data;
  if (!name) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Device name is required'
    );
  }

  try {
    const deviceData = {
      name,
      type,
      userId: context.auth.uid,
      status: 'active',
      created: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    };

    const deviceRef = await admin.firestore()
      .collection('devices')
      .add(deviceData);

    return { deviceId: deviceRef.id };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'Failed to register device'
    );
  }
});

// Handle device session cleanup
export const cleanupInactiveSessions = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = Date.now();
    const sessionsRef = admin.database().ref('sessions');
    
    try {
      const snapshot = await sessionsRef
        .orderByChild('expiresAt')
        .endAt(now)
        .once('value');

      const updates: { [key: string]: null } = {};
      snapshot.forEach(child => {
        updates[child.key] = null;
      });

      if (Object.keys(updates).length > 0) {
        await sessionsRef.update(updates);
        console.log(`Cleaned up ${Object.keys(updates).length} expired sessions`);
      }

      return null;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return null;
    }
  });

// Monitor device activity and update status
export const updateDeviceStatus = functions.firestore
  .document('devices/{deviceId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    if (!newData || !previousData) return null;

    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    const lastActive = newData.lastActive?.toDate?.() || new Date(newData.lastActive);
    const timeSinceLastActive = now - lastActive.getTime();

    if (
      previousData.status === 'active' &&
      timeSinceLastActive > inactiveThreshold
    ) {
      // Update device status to inactive
      await change.after.ref.update({
        status: 'inactive',
        lastStatusChange: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify user of device inactivity
      const userRef = admin.firestore()
        .collection('users')
        .doc(newData.userId);

      await admin.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) return;

        const notifications = userDoc.data()?.notifications || [];
        notifications.push({
          type: 'device_inactive',
          deviceId: context.params.deviceId,
          deviceName: newData.name,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(userRef, { notifications });
      });
    }

    return null;
});

// Handle device readings and alerts
export const processEnvironmentalReadings = functions.firestore
  .document('devices/{deviceId}/readings/{readingId}')
  .onCreate(async (snapshot, context) => {
    const reading = snapshot.data();
    const { deviceId } = context.params;

    try {
      const deviceDoc = await admin.firestore()
        .collection('devices')
        .doc(deviceId)
        .get();

      if (!deviceDoc.exists) return null;

      const deviceData = deviceDoc.data();
      if (!deviceData) return null;

      const userDoc = await admin.firestore()
        .collection('users')
        .doc(deviceData.userId)
        .get();

      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      if (!userData) return null;

      // Check thresholds and create alerts
      const thresholds = userData.thresholds || {};
      const alerts = [];

      if (reading.temperature < thresholds.temperature?.min ||
          reading.temperature > thresholds.temperature?.max) {
        alerts.push({
          type: 'temperature',
          level: 'warning',
          value: reading.temperature,
          message: `Temperature outside range: ${reading.temperature}°C`,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (reading.airQuality < thresholds.airQuality?.hazardous) {
        alerts.push({
          type: 'air_quality',
          level: 'danger',
          value: reading.airQuality,
          message: `Hazardous air quality level: ${reading.airQuality}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Save alerts if any
      if (alerts.length > 0) {
        const batch = admin.firestore().batch();
        
        alerts.forEach(alert => {
          const alertRef = admin.firestore()
            .collection('devices')
            .doc(deviceId)
            .collection('alerts')
            .doc();
          
          batch.set(alertRef, alert);
        });

        await batch.commit();
      }

      return null;
    } catch (error) {
      console.error('Error processing environmental readings:', error);
      return null;
    }
});
