import { KitronikError } from '../utils/errorHandling';
import { SensorData, MonitoringThresholds, OutputStatus } from '../types/sensor';

export class ValidationService {
  static validateSensorData(data: Partial<SensorData>): void {
    if (!data.timestamp) {
      throw new KitronikError('Timestamp is required', 'VALIDATION_ERROR');
    }

    if (typeof data.temperature !== 'number' || 
        data.temperature < -50 || 
        data.temperature > 100) {
      throw new KitronikError('Invalid temperature value', 'VALIDATION_ERROR');
    }

    if (typeof data.humidity !== 'number' || 
        data.humidity < 0 || 
        data.humidity > 100) {
      throw new KitronikError('Invalid humidity value', 'VALIDATION_ERROR');
    }

    if (typeof data.pressure !== 'number' || 
        data.pressure < 800 || 
        data.pressure > 1200) {
      throw new KitronikError('Invalid pressure value', 'VALIDATION_ERROR');
    }

    if (typeof data.airQuality !== 'number' || 
        data.airQuality < 0 || 
        data.airQuality > 100) {
      throw new KitronikError('Invalid air quality value', 'VALIDATION_ERROR');
    }
  }

  static validateThresholds(thresholds: MonitoringThresholds): void {
    // Temperature thresholds
    if (!thresholds.temperature ||
        typeof thresholds.temperature.min !== 'number' ||
        typeof thresholds.temperature.max !== 'number' ||
        thresholds.temperature.min >= thresholds.temperature.max ||
        thresholds.temperature.min < -50 ||
        thresholds.temperature.max > 100) {
      throw new KitronikError('Invalid temperature thresholds', 'VALIDATION_ERROR');
    }

    // Humidity thresholds
    if (!thresholds.humidity ||
        typeof thresholds.humidity.min !== 'number' ||
        typeof thresholds.humidity.max !== 'number' ||
        thresholds.humidity.min >= thresholds.humidity.max ||
        thresholds.humidity.min < 0 ||
        thresholds.humidity.max > 100) {
      throw new KitronikError('Invalid humidity thresholds', 'VALIDATION_ERROR');
    }

    // Air quality thresholds
    if (!thresholds.airQuality ||
        typeof thresholds.airQuality.poor !== 'number' ||
        typeof thresholds.airQuality.hazardous !== 'number' ||
        thresholds.airQuality.hazardous >= thresholds.airQuality.poor ||
        thresholds.airQuality.hazardous < 0 ||
        thresholds.airQuality.poor > 100) {
      throw new KitronikError('Invalid air quality thresholds', 'VALIDATION_ERROR');
    }
  }

  static validateOutputStatus(status: Partial<OutputStatus>): void {
    if (typeof status.displayActive !== 'boolean') {
      throw new KitronikError('Invalid display status', 'VALIDATION_ERROR');
    }

    if (typeof status.ledsActive !== 'boolean') {
      throw new KitronikError('Invalid LED status', 'VALIDATION_ERROR');
    }

    if (!Array.isArray(status.highPowerState) || 
        status.highPowerState.length !== 4 ||
        !status.highPowerState.every(state => typeof state === 'boolean')) {
      throw new KitronikError('Invalid high power output states', 'VALIDATION_ERROR');
    }

    if (!Array.isArray(status.servoPositions) || 
        status.servoPositions.length !== 2 ||
        !status.servoPositions.every(pos => 
          typeof pos === 'number' && pos >= 0 && pos <= 180
        )) {
      throw new KitronikError('Invalid servo positions', 'VALIDATION_ERROR');
    }

    if (typeof status.lastUpdate !== 'string' || !status.lastUpdate) {
      throw new KitronikError('Invalid last update timestamp', 'VALIDATION_ERROR');
    }
  }

  static validateDeviceConfiguration(config: any): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new KitronikError('Invalid device name', 'VALIDATION_ERROR');
    }

    if (!config.type || typeof config.type !== 'string') {
      throw new KitronikError('Invalid device type', 'VALIDATION_ERROR');
    }

    if (!config.userId || typeof config.userId !== 'string') {
      throw new KitronikError('Invalid user ID', 'VALIDATION_ERROR');
    }

    if (!['active', 'inactive', 'disabled'].includes(config.status)) {
      throw new KitronikError('Invalid device status', 'VALIDATION_ERROR');
    }
  }

  static validateAlertConfiguration(alert: any): void {
    if (!alert.type || typeof alert.type !== 'string') {
      throw new KitronikError('Invalid alert type', 'VALIDATION_ERROR');
    }

    if (!['info', 'warning', 'danger'].includes(alert.level)) {
      throw new KitronikError('Invalid alert level', 'VALIDATION_ERROR');
    }

    if (!alert.message || typeof alert.message !== 'string') {
      throw new KitronikError('Invalid alert message', 'VALIDATION_ERROR');
    }

    if (alert.value !== undefined && typeof alert.value !== 'number') {
      throw new KitronikError('Invalid alert value', 'VALIDATION_ERROR');
    }
  }

  static validateSessionData(session: any): void {
    if (!session.userId || typeof session.userId !== 'string') {
      throw new KitronikError('Invalid user ID in session', 'VALIDATION_ERROR');
    }

    if (!session.deviceId || typeof session.deviceId !== 'string') {
      throw new KitronikError('Invalid device ID in session', 'VALIDATION_ERROR');
    }

    if (typeof session.lastActivity !== 'number' || session.lastActivity <= 0) {
      throw new KitronikError('Invalid last activity timestamp', 'VALIDATION_ERROR');
    }

    if (typeof session.expiresAt !== 'number' || 
        session.expiresAt <= session.lastActivity) {
      throw new KitronikError('Invalid expiration timestamp', 'VALIDATION_ERROR');
    }
  }
}