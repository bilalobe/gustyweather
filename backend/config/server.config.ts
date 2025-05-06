import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const serverConfig = {
  firebase: {
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS
  },
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  auth: {
    tokenExpiration: 3600, // 1 hour
    adminEmails: (process.env.ADMIN_EMAILS || '').split(',')
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});