import { Request, Response, NextFunction } from 'express';
import admin from '../utils/firebase';
import { serverConfig } from '../config/server.config';

export interface SessionData {
  userId: string;
  deviceId?: string;
  lastActivity: number;
  expiresAt: number;
}

export interface SessionRequest extends Request {
  session?: SessionData;
}

export const validateSession = async (
  req: SessionRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(401).json({ error: 'Missing session token' });
    }

    const sessionRef = admin.database().ref(`sessions/${sessionToken}`);
    const snapshot = await sessionRef.once('value');
    const session = snapshot.val() as SessionData;

    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    if (Date.now() > session.expiresAt) {
      await sessionRef.remove();
      return res.status(401).json({ error: 'Session expired' });
    }

    // Update last activity
    await sessionRef.update({
      lastActivity: Date.now(),
      expiresAt: Date.now() + serverConfig.auth.tokenExpiration * 1000
    });

    req.session = session;
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
};