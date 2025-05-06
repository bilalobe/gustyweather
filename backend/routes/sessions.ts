import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateDevice, DeviceRequest } from '../middleware/device.middleware';
import admin from '../utils/firebase';
import { serverConfig } from '../config/server.config';

const router = express.Router();

// Start a new session
router.post('/start', [requireAuth, validateDevice], async (req: DeviceRequest, res) => {
  try {
    const sessionToken = uuidv4();
    const now = Date.now();
    
    const sessionData = {
      userId: req.user?.uid,
      deviceId: req.deviceInfo?.id,
      lastActivity: now,
      expiresAt: now + serverConfig.auth.tokenExpiration * 1000,
      deviceName: req.deviceInfo?.name,
      deviceType: req.deviceInfo?.type
    };

    await admin.database()
      .ref(`sessions/${sessionToken}`)
      .set(sessionData);

    res.json({ 
      sessionToken,
      expiresAt: sessionData.expiresAt
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End a session
router.post('/end', [requireAuth], async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token required' });
    }

    const sessionRef = admin.database().ref(`sessions/${sessionToken}`);
    const snapshot = await sessionRef.once('value');
    const session = snapshot.val();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== req.user?.uid) {
      return res.status(403).json({ error: 'Not authorized to end this session' });
    }

    await sessionRef.remove();
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get active sessions for user
router.get('/active', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionsRef = admin.database().ref('sessions');
    const snapshot = await sessionsRef
      .orderByChild('userId')
      .equalTo(req.user?.uid)
      .once('value');

    const now = Date.now();
    const sessions = [];
    snapshot.forEach(child => {
      const session = child.val();
      if (session.expiresAt > now) {
        sessions.push({
          id: child.key,
          ...session
        });
      }
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// End all sessions for a device
router.delete('/device/:deviceId', [requireAuth], async (req: AuthenticatedRequest, res) => {
  try {
    const { deviceId } = req.params;
    
    const sessionsRef = admin.database().ref('sessions');
    const snapshot = await sessionsRef
      .orderByChild('deviceId')
      .equalTo(deviceId)
      .once('value');

    const updates: { [key: string]: null } = {};
    snapshot.forEach(child => {
      const session = child.val();
      if (session.userId === req.user?.uid) {
        updates[child.key] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      await sessionsRef.update(updates);
    }

    res.json({ 
      success: true,
      sessionsEnded: Object.keys(updates).length
    });
  } catch (error) {
    console.error('Error ending device sessions:', error);
    res.status(500).json({ error: 'Failed to end device sessions' });
  }
});

export default router;