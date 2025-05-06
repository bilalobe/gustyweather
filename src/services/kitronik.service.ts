import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { SensorStatus, OutputStatus, DisplayPattern, LEDPattern } from '../../backend/types/sensor';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class KitronikError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'KitronikError';
    }
}

async function withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                if (status && status < 500 && status !== 408) {
                    throw new KitronikError(
                        error.response?.data?.error || error.message,
                        'CLIENT_ERROR'
                    );
                }
            }
            
            if (attempt === maxRetries - 1) {
                throw new KitronikError(
                    error instanceof Error ? error.message : 'Operation failed',
                    'OPERATION_FAILED'
                );
            }
            
            await delay(1000 * (attempt + 1));
        }
    }
    throw new KitronikError('Max retries exceeded');
}

async function getAuthHeaders() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        throw new KitronikError('User not authenticated', 'AUTH_ERROR');
    }

    // Get device token from local storage
    const deviceToken = localStorage.getItem('deviceToken');
    if (!deviceToken) {
        throw new KitronikError('No device token found', 'DEVICE_ERROR');
    }

    // Get session token from local storage
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        throw new KitronikError('No session token found', 'SESSION_ERROR');
    }

    const token = await user.getIdToken();
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'x-device-token': deviceToken,
            'x-session-token': sessionToken
        }
    };
}

export class KitronikOutputs {
    static async registerDevice(deviceName: string): Promise<string> {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            throw new KitronikError('User not authenticated', 'AUTH_ERROR');
        }

        const token = await user.getIdToken();
        const response = await axios.post(
            `${BASE_URL}/devices/register`,
            { name: deviceName },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const { deviceToken } = response.data;
        localStorage.setItem('deviceToken', deviceToken);
        return deviceToken;
    }

    static async startSession(): Promise<string> {
        const headers = await getAuthHeaders();
        const response = await axios.post(
            `${BASE_URL}/sessions/start`,
            {},
            headers
        );

        const { sessionToken } = response.data;
        localStorage.setItem('sessionToken', sessionToken);
        return sessionToken;
    }

    static async updateDisplay(patterns: DisplayPattern[]): Promise<void> {
        const config = await getAuthHeaders();
        await withErrorHandling(() => 
            axios.post(`${BASE_URL}/sensors/outputs/display`, { patterns }, config)
        );
    }

    static async setLEDPattern(pattern: LEDPattern[]): Promise<void> {
        const config = await getAuthHeaders();
        await withErrorHandling(() => 
            axios.post(`${BASE_URL}/sensors/outputs/leds`, { pattern }, config)
        );
    }

    static async setHighPowerOutput(index: number, state: boolean): Promise<void> {
        const config = await getAuthHeaders();
        await withErrorHandling(() => 
            axios.post(`${BASE_URL}/sensors/outputs/power/${index}`, { state }, config)
        );
    }

    static async setServoPosition(index: number, angle: number): Promise<void> {
        const config = await getAuthHeaders();
        await withErrorHandling(() => 
            axios.post(`${BASE_URL}/sensors/outputs/servo/${index}`, { angle }, config)
        );
    }

    static async getOutputStatus(): Promise<OutputStatus> {
        const config = await getAuthHeaders();
        return await withErrorHandling(async () => {
            const response = await axios.get(`${BASE_URL}/sensors/outputs/status`, config);
            return response.data;
        });
    }

    static async getSensorStatus(): Promise<SensorStatus> {
        const config = await getAuthHeaders();
        return await withErrorHandling(async () => {
            const response = await axios.get(`${BASE_URL}/sensors/status`, config);
            return response.data;
        });
    }

    static async getEnvironmentalData(): Promise<any> {
        const config = await getAuthHeaders();
        return await withErrorHandling(async () => {
            const response = await axios.get(`${BASE_URL}/sensors/environmental`, config);
            return response.data;
        });
    }

    static clearTokens(): void {
        localStorage.removeItem('deviceToken');
        localStorage.removeItem('sessionToken');
    }
}