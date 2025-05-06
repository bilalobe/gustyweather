import { BaselineStorage } from '../../Kitronik5038Port/lib/data/BaselineStorage';
import { SensorReading } from '../types/sensor';
import { InfluxDBService } from './influxdb.service';
import { BaselineCalculation } from '../../Kitronik5038Port/lib/BaselineCalculation';
import { SensorError } from '../../Kitronik5038Port/lib/err/SensorError';
import { KitronikOLED } from '../../Kitronik5038Port/lib/KitronikOLED';
import admin from '../utils/firebase';
import { KitronikError } from '../utils/errorHandling';

export interface BaselineData {
  temperature: number;
  humidity: number;
  pressure: number;
  resistance: number;
  timestamp: number;
}

export class BaselineService {
    private storage: BaselineStorage;
    private baselineCalc: BaselineCalculation;
    private oled: KitronikOLED;
    private static readonly BASELINE_COLLECTION = 'baselines';
    private static readonly DEVICE_COLLECTION = 'devices';
    
    constructor(private influxDB: InfluxDBService) {
        this.storage = new BaselineStorage();
        this.baselineCalc = new BaselineCalculation();
        this.oled = new KitronikOLED();
    }

    public async calibrateBaselines(displayProgress = true): Promise<void> {
        if (displayProgress) {
            this.oled.clear();
            this.oled.write('Calibrating...', { row: 1 });
            this.oled.update();
        }

        try {
            const reading = await this.baselineCalc.calibrate();
            await this.storage.save(reading);
            await this.influxDB.writeSensorReading(reading);

            if (displayProgress) {
                this.oled.clear();
                this.oled.write('Calibration', { row: 1 });
                this.oled.write('Complete!', { row: 2 });
                this.oled.update();
                setTimeout(() => {
                    this.oled.clear();
                    this.oled.update();
                }, 2000);
            }
        } catch (error) {
            if (displayProgress) {
                this.oled.clear();
                this.oled.write('Calibration', { row: 1 });
                this.oled.write('Failed!', { row: 2 });
                this.oled.update();
                setTimeout(() => {
                    this.oled.clear();
                    this.oled.update();
                }, 2000);
            }
            throw new SensorError('Baseline calibration failed');
        }
    }

    public async getRecentBaselines(hours = 24): Promise<SensorReading[]> {
        const end = new Date();
        const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
        return await this.influxDB.getReadingsInTimeRange(
            start.toISOString(),
            end.toISOString()
        );
    }

    public async validateBaseline(reading: SensorReading): Promise<boolean> {
        const storedBaseline = await this.storage.load();
        if (!storedBaseline) return false;

        const diff = this.baselineCalc.compareBaselines(reading, storedBaseline);
        return diff <= this.baselineCalc.getToleranceThreshold();
    }

    public async updateBaseline(reading: SensorReading): Promise<void> {
        await this.storage.save({
            timestamp: new Date(),
            ...reading
        });
        await this.influxDB.writeSensorReading(reading);
    }

    static async verifyDeviceOwnership(userId: string, deviceId: string): Promise<boolean> {
        try {
            const deviceDoc = await admin.firestore()
                .collection(this.DEVICE_COLLECTION)
                .doc(deviceId)
                .get();

            if (!deviceDoc.exists) {
                throw new KitronikError('Device not found', 'DEVICE_ERROR');
            }

            return deviceDoc.data()?.userId === userId;
        } catch (error) {
            throw new KitronikError(
                'Failed to verify device ownership',
                'AUTH_ERROR',
                error
            );
        }
    }

    static async getBaseline(deviceId: string, userId: string): Promise<BaselineData | null> {
        try {
            // Verify device ownership
            const isOwner = await this.verifyDeviceOwnership(userId, deviceId);
            if (!isOwner) {
                throw new KitronikError('Not authorized for this device', 'AUTH_ERROR');
            }

            const baselineDoc = await admin.firestore()
                .collection(this.BASELINE_COLLECTION)
                .doc(deviceId)
                .get();

            return baselineDoc.exists ? baselineDoc.data() as BaselineData : null;
        } catch (error) {
            throw new KitronikError(
                'Failed to retrieve baseline data',
                'BASELINE_ERROR',
                error
            );
        }
    }

    static async setBaseline(
        deviceId: string,
        userId: string,
        baselineData: Omit<BaselineData, 'timestamp'>
    ): Promise<void> {
        try {
            // Verify device ownership
            const isOwner = await this.verifyDeviceOwnership(userId, deviceId);
            if (!isOwner) {
                throw new KitronikError('Not authorized for this device', 'AUTH_ERROR');
            }

            await admin.firestore()
                .collection(this.BASELINE_COLLECTION)
                .doc(deviceId)
                .set({
                    ...baselineData,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            throw new KitronikError(
                'Failed to set baseline data',
                'BASELINE_ERROR',
                error
            );
        }
    }

    static async deleteBaseline(deviceId: string, userId: string): Promise<void> {
        try {
            // Verify device ownership
            const isOwner = await this.verifyDeviceOwnership(userId, deviceId);
            if (!isOwner) {
                throw new KitronikError('Not authorized for this device', 'AUTH_ERROR');
            }

            await admin.firestore()
                .collection(this.BASELINE_COLLECTION)
                .doc(deviceId)
                .delete();
        } catch (error) {
            throw new KitronikError(
                'Failed to delete baseline data',
                'BASELINE_ERROR',
                error
            );
        }
    }

    static async updateDeviceStatus(
        deviceId: string,
        userId: string,
        status: 'active' | 'inactive' | 'disabled'
    ): Promise<void> {
        try {
            // Verify device ownership
            const isOwner = await this.verifyDeviceOwnership(userId, deviceId);
            if (!isOwner) {
                throw new KitronikError('Not authorized for this device', 'AUTH_ERROR');
            }

            await admin.firestore()
                .collection(this.DEVICE_COLLECTION)
                .doc(deviceId)
                .update({
                    status,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            throw new KitronikError(
                'Failed to update device status',
                'DEVICE_ERROR',
                error
            );
        }
    }

    static async getDeviceBaselines(userId: string): Promise<Record<string, BaselineData>> {
        try {
            // Get all user's devices
            const devicesSnapshot = await admin.firestore()
                .collection(this.DEVICE_COLLECTION)
                .where('userId', '==', userId)
                .get();

            const deviceIds = devicesSnapshot.docs.map(doc => doc.id);
            
            // Get baselines for all devices
            const baselinesSnapshot = await admin.firestore()
                .collection(this.BASELINE_COLLECTION)
                .where(admin.firestore.FieldPath.documentId(), 'in', deviceIds)
                .get();

            const baselines: Record<string, BaselineData> = {};
            baselinesSnapshot.forEach(doc => {
                baselines[doc.id] = doc.data() as BaselineData;
            });

            return baselines;
        } catch (error) {
            throw new KitronikError(
                'Failed to retrieve device baselines',
                'BASELINE_ERROR',
                error
            );
        }
    }
}