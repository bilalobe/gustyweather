import admin from './firebase';

export type ErrorType = 
  | 'AUTH_ERROR'
  | 'DEVICE_ERROR'
  | 'SENSOR_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'HARDWARE_ERROR'
  | 'CALIBRATION_ERROR'
  | 'SESSION_ERROR'
  | 'RATE_LIMIT_ERROR';

export class KitronikError extends Error {
  type: ErrorType;
  timestamp: number;
  originalError?: any;

  constructor(message: string, type: ErrorType, originalError?: any) {
    super(message);
    this.name = 'KitronikError';
    this.type = type;
    this.timestamp = Date.now();
    this.originalError = originalError;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError
    };
  }
}

export class OutputError extends KitronikError {
  constructor(message: string, originalError?: any) {
    super(message, 'DEVICE_ERROR', originalError);
    this.name = 'OutputError';
  }
}

export class SensorError extends KitronikError {
  constructor(message: string, originalError?: any) {
    super(message, 'SENSOR_ERROR', originalError);
    this.name = 'SensorError';
  }
}

export class CommunicationError extends KitronikError {
  constructor(message: string, originalError?: any) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'CommunicationError';
  }
}

export function handleKitronikError(error: unknown): KitronikError {
  if (error instanceof KitronikError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to categorize known error patterns
    if (error.message.includes('I2C') || error.message.includes('communication')) {
      return new CommunicationError(error.message, error);
    }
    if (error.message.includes('sensor') || error.message.includes('reading')) {
      return new SensorError(error.message, error);
    }
    if (error.message.includes('output') || error.message.includes('display') || 
        error.message.includes('LED') || error.message.includes('servo')) {
      return new OutputError(error.message, error);
    }
  }

  // Generic fallback
  return new KitronikError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    error
  );
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof KitronikError) {
    return error.type === 'NETWORK_ERROR' || 
           error.type === 'SENSOR_ERROR';
  }
  return false;
}

export async function logError(
  error: KitronikError | Error,
  context: Record<string, any> = {}
): Promise<void> {
  const errorDoc = {
    message: error.message,
    type: error instanceof KitronikError ? error.type : 'UNKNOWN_ERROR',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    stack: error.stack,
    context,
    originalError: error instanceof KitronikError ? error.originalError : undefined
  };

  try {
    await admin.firestore()
      .collection('errors')
      .add(errorDoc);
  } catch (logError) {
    console.error('Failed to log error:', logError);
    console.error('Original error:', error);
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = 60000
): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      const ref = admin.database().ref(`rateLimits/${key}`);
      const now = Date.now();
      const windowStart = now - windowMs;

      const snapshot = await ref
        .orderByChild('timestamp')
        .startAt(windowStart)
        .once('value');

      const requests = [];
      snapshot.forEach(child => {
        requests.push({
          key: child.key,
          timestamp: child.val().timestamp
        });
      });

      if (requests.length >= limit) {
        resolve(false);
        return;
      }

      await ref.push().set({ timestamp: now });
      
      // Cleanup old entries
      const cleanupPromises = requests
        .filter(r => r.timestamp < windowStart)
        .map(r => ref.child(r.key).remove());
      
      await Promise.all(cleanupPromises);
      
      resolve(true);
    } catch (error) {
      console.error('Rate limit error:', error);
      resolve(true); // Fail open on error
    }
  });
}

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): () => Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    shouldRetry = () => true
  } = options;

  return async () => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries || !shouldRetry(lastError)) {
          throw lastError;
        }

        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    throw lastError;
  };
}

export async function handleApiError(
  error: any,
  userId?: string,
  deviceId?: string
): Promise<void> {
  const errorContext = {
    userId,
    deviceId,
    timestamp: Date.now()
  };

  if (error instanceof KitronikError) {
    await logError(error, errorContext);
    return;
  }

  const apiError = new KitronikError(
    error.message || 'An unexpected error occurred',
    'NETWORK_ERROR',
    error
  );

  await logError(apiError, errorContext);
}