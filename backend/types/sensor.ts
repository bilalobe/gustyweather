import { SensorCalibrationData } from '../../Kitronik5038Port/lib/data/SensorData';
import { DataValidation } from '../../Kitronik5038Port/lib/validation/DataValidation';

export interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
  airQuality: number;
  timestamp: number;
}

export interface SensorReadingResponse {
    time: number;
    temperature: number;
    pressure: number;
    humidity: number;
    gasResistance: number;
    iaqPercent: number;
    iaqScore: number;
    eCO2Value: number;
}

export interface EnvironmentalData extends SensorData {
    airQualityIndex: number;
    airQualityAccuracy: number;
    co2Equivalent: number;
    vocEquivalent: number;
    ambientTemperature: number;
}

export interface CalibrationResult {
    success: boolean;
    baselineTemp: number;
    baselineHumidity: number;
    baselineResistance: number;
    timestamp: string;
}

export interface KitronikConfig {
    iaqMode: 'static' | 'dynamic';
    samplingInterval?: number;
    gasSettings?: {
        targetTemp: number;
        heatDuration: number;
        ambientTemp: number;
    };
}

export interface KitronikStatus {
    isInitialized: boolean;
    lastReadingTime: string;
    sensorMode: string;
    calibrationStatus: boolean;
}

export interface SensorReading {
    temperature: number;
    humidity: number;
    pressure: number;
    gas: number;
    airQualityIndex: number;
    timestamp: string;
}

export interface WeatherAlert {
    type: 'temperature' | 'humidity' | 'pressure' | 'airQuality';
    level: 'info' | 'warning' | 'danger';
    message: string;
}

export interface MonitoringThresholds {
  temperature: {
    min: number;
    max: number;
  };
  humidity: {
    min: number;
    max: number;
  };
  airQuality: {
    poor: number;
    hazardous: number;
  };
}

export interface OutputStatus {
  displayActive: boolean;
  ledsActive: boolean;
  highPowerState: boolean[];
  servoPositions: number[];
  lastUpdate: string;
}

export interface DisplayPattern {
  text: string[];
  duration?: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface LEDPattern {
  index: number;
  r: number;
  g: number;
  b: number;
  duration?: number;
}

export interface DeviceConfiguration {
  name: string;
  type: string;
  userId: string;
  status: 'active' | 'inactive' | 'disabled';
  created: number;
  lastActive: number;
  thresholds?: MonitoringThresholds;
}

export interface Alert {
  type: 'temperature' | 'humidity' | 'pressure' | 'airQuality' | 'device';
  level: 'info' | 'warning' | 'danger';
  message: string;
  timestamp: number;
  value?: number;
  deviceId: string;
}

export interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: any;
  timestamp: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'error';
  lastReading: number;
  connectionStatus: 'connected' | 'disconnected';
  sensorStatus: {
    temperature: boolean;
    humidity: boolean;
    pressure: boolean;
    airQuality: boolean;
  };
  calibrationStatus: boolean;
  alerts: string[];
}

export class SensorValidator {
    static validateReading(reading: SensorReading): boolean {
        return DataValidation.validateSensorReading({
            temperature: reading.temperature,
            pressure: reading.pressure,
            humidity: reading.humidity,
            gasResistance: reading.gas,
            airQualityIndex: reading.airQualityIndex
        });
    }
}

export interface SensorStatus {
  connected: boolean;
  sensors: {
    temperature: boolean;
    humidity: boolean;
    pressure: boolean;
    airQuality: boolean;
  };
  lastUpdate: string;
}

export type KitronikConfig = SensorConfig;
