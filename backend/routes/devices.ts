import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import admin from '../utils/firebase';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all devices for a user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const devicesSnapshot = await admin.firestore()
      .collection('devices')
      .where('userId', '==', req.user?.uid)
      .get();

    const devices = devicesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Register a new device
router.post('/register', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Device name is required' });
    }

    const deviceToken = uuidv4();
    const deviceData = {
      id: deviceToken,
      name,
      userId: req.user?.uid,
      status: 'active',
      type: 'kitronik',
      created: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore()
      .collection('devices')
      .doc(deviceToken)
      .set(deviceData);

    res.json({ deviceToken, deviceData });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Delete a device
router.delete('/:deviceId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { deviceId } = req.params;
    
    const deviceDoc = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .get();

    if (!deviceDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (deviceDoc.data()?.userId !== req.user?.uid) {
      return res.status(403).json({ error: 'Not authorized to delete this device' });
    }

    // Remove device and its associated sessions
    await Promise.all([
      deviceDoc.ref.delete(),
      admin.database().ref(`sessions`).orderByChild('deviceId').equalTo(deviceId).once('value')
        .then(snapshot => {
          const updates: { [key: string]: null } = {};
          snapshot.forEach(child => {
            updates[child.key] = null;
          });
          return admin.database().ref('sessions').update(updates);
        })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Update device status
router.patch('/:deviceId/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const deviceDoc = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .get();

    if (!deviceDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (deviceDoc.data()?.userId !== req.user?.uid) {
      return res.status(403).json({ error: 'Not authorized to update this device' });
    }

    await deviceDoc.ref.update({
      status,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

export default router;