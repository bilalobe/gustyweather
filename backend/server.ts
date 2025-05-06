import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import sensorRoutes from './routes/sensors';
import deviceRoutes from './routes/devices';
import weatherRoutes from './routes/weather';
import { serverConfig } from './config/server.config';
import admin from './utils/firebase';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Token cleanup job - remove expired sessions
setInterval(async () => {
  try {
    const sessionsRef = admin.database().ref('sessions');
    const now = Date.now();
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
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Routes
app.use('/api/sensors', sensorRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/weather', weatherRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Start server
const port = serverConfig.server.port;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${serverConfig.server.env}`);
});