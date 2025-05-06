import admin from '../utils/firebase';
import { KitronikError } from '../utils/errorHandling';
import { BaselineService } from './baseline.service';
import { MonitoringService } from './monitoring.service';
import { KitronikService } from './kitronik.service';
import { SensorData } from '../types/sensor';

interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: any;
  timestamp: number;
}

interface HealthStatus {
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

interface ReportOptions {
  startDate?: Date;
  endDate?: Date;
}

export class DiagnosticService {
  private kitronikService: KitronikService;
  private monitoringService: MonitoringService;

  constructor(kitronikService: KitronikService, monitoringService: MonitoringService) {
    this.kitronikService = kitronikService;
    this.monitoringService = monitoringService;
  }

  async runFullDiagnostics(deviceId: string, userId: string): Promise<DiagnosticResult[]> {
    // Verify device ownership first
    await BaselineService.verifyDeviceOwnership(userId, deviceId);

    const results: DiagnosticResult[] = [];
    const now = Date.now();

    try {
      // Test sensor connectivity
      const sensorStatus = await this.kitronikService.getSensorStatus();
      results.push({
        passed: sensorStatus.connected,
        message: sensorStatus.connected ? 'Sensor connection successful' : 'Sensor connection failed',
        timestamp: now
      });

      // Test reading capabilities
      const readings = await this.kitronikService.readSensorData();
      const readingsValid = this.validateReadings(deviceId, readings);
      results.push({
        passed: readingsValid.passed,
        message: readingsValid.message,
        details: readingsValid.details,
        timestamp: now
      });

      // Test output controls
      const outputTests = await this.testOutputControls(deviceId);
      results.push(...outputTests);

      // Verify calibration
      const calibrationStatus = await this.verifyCalibration(deviceId, userId);
      results.push({
        passed: calibrationStatus.isCalibrated,
        message: calibrationStatus.message,
        details: calibrationStatus.details,
        timestamp: now
      });

    } catch (error) {
      results.push({
        passed: false,
        message: 'Diagnostic tests failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now
      });
    }

    // Save diagnostic results
    await this.saveDiagnosticResults(deviceId, results);

    return results;
  }

  async performSelfTest(deviceId: string, userId: string): Promise<DiagnosticResult> {
    await BaselineService.verifyDeviceOwnership(userId, deviceId);

    try {
      // Test basic sensor functionality
      await this.kitronikService.getSensorStatus();
      
      // Test reading acquisition
      const readings = await this.kitronikService.readSensorData();
      
      // Verify reading values are within expected ranges
      const isValid = this.validateReadingRanges(readings);

      return {
        passed: isValid,
        message: isValid ? 'Self-test passed' : 'Self-test failed: readings out of range',
        details: readings,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Self-test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async validateReadings(deviceId: string, readings: SensorData): Promise<DiagnosticResult> {
    const validRanges = {
      temperature: { min: -50, max: 100 },
      humidity: { min: 0, max: 100 },
      pressure: { min: 800, max: 1200 },
      airQuality: { min: 0, max: 100 }
    };

    const issues: string[] = [];
    let passed = true;

    Object.entries(validRanges).forEach(([key, range]) => {
      const value = readings[key as keyof SensorData];
      if (typeof value !== 'number' || value < range.min || value > range.max) {
        issues.push(`${key} reading out of range: ${value}`);
        passed = false;
      }
    });

    return {
      passed,
      message: passed ? 'All readings valid' : 'Invalid readings detected',
      details: { issues, readings },
      timestamp: Date.now()
    };
  }

  async checkDeviceHealth(deviceId: string, userId: string): Promise<HealthStatus> {
    await BaselineService.verifyDeviceOwnership(userId, deviceId);

    const deviceDoc = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .get();

    if (!deviceDoc.exists) {
      throw new KitronikError('Device not found', 'DEVICE_ERROR');
    }

    const deviceData = deviceDoc.data();
    const lastReading = deviceData?.lastReading?.toDate?.() || new Date(deviceData?.lastReading);
    const now = new Date();
    const timeSinceLastReading = now.getTime() - lastReading.getTime();

    // Get latest sensor status
    const sensorStatus = await this.kitronikService.getSensorStatus();

    // Get calibration info
    const baseline = await BaselineService.getBaseline(deviceId, userId);

    // Get recent alerts
    const alerts = await this.getRecentAlerts(deviceId);

    const health: HealthStatus = {
      overall: 'healthy',
      lastReading: lastReading.getTime(),
      connectionStatus: timeSinceLastReading < 300000 ? 'connected' : 'disconnected', // 5 minutes
      sensorStatus: {
        temperature: sensorStatus.sensors.temperature,
        humidity: sensorStatus.sensors.humidity,
        pressure: sensorStatus.sensors.pressure,
        airQuality: sensorStatus.sensors.airQuality
      },
      calibrationStatus: Boolean(baseline),
      alerts: alerts.map(alert => alert.message)
    };

    // Determine overall health
    if (!health.calibrationStatus || health.connectionStatus === 'disconnected') {
      health.overall = 'error';
    } else if (health.alerts.length > 0 || Object.values(health.sensorStatus).includes(false)) {
      health.overall = 'warning';
    }

    return health;
  }

  async generateReport(deviceId: string, userId: string, options: ReportOptions = {}): Promise<any> {
    await BaselineService.verifyDeviceOwnership(userId, deviceId);

    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to last 24 hours
      endDate = new Date()
    } = options;

    // Fetch diagnostic history
    const diagnostics = await this.getDiagnosticHistory(deviceId, startDate, endDate);
    
    // Fetch readings history
    const readings = await this.getReadingsHistory(deviceId, startDate, endDate);
    
    // Fetch alerts history
    const alerts = await this.getAlertsHistory(deviceId, startDate, endDate);

    // Generate statistics
    const stats = this.calculateStatistics(readings);

    return {
      deviceId,
      reportPeriod: { startDate, endDate },
      diagnosticSummary: this.summarizeDiagnostics(diagnostics),
      readingStats: stats,
      alertSummary: this.summarizeAlerts(alerts),
      timestamp: new Date()
    };
  }

  private async testOutputControls(deviceId: string): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const now = Date.now();

    try {
      // Test display
      await this.kitronikService.updateDisplay([{ text: ['Test'] }]);
      results.push({
        passed: true,
        message: 'Display test passed',
        timestamp: now
      });
    } catch (error) {
      results.push({
        passed: false,
        message: 'Display test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now
      });
    }

    try {
      // Test LEDs
      await this.kitronikService.setLEDPattern([{ index: 0, r: 255, g: 255, b: 255 }]);
      results.push({
        passed: true,
        message: 'LED test passed',
        timestamp: now
      });
    } catch (error) {
      results.push({
        passed: false,
        message: 'LED test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now
      });
    }

    return results;
  }

  private validateReadingRanges(readings: SensorData): boolean {
    return (
      readings.temperature >= -50 && readings.temperature <= 100 &&
      readings.humidity >= 0 && readings.humidity <= 100 &&
      readings.pressure >= 800 && readings.pressure <= 1200 &&
      readings.airQuality >= 0 && readings.airQuality <= 100
    );
  }

  private async saveDiagnosticResults(deviceId: string, results: DiagnosticResult[]): Promise<void> {
    await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .collection('diagnostics')
      .add({
        results,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
  }

  private async getRecentAlerts(deviceId: string): Promise<any[]> {
    const alertsSnapshot = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .collection('alerts')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    return alertsSnapshot.docs.map(doc => doc.data());
  }

  private async getDiagnosticHistory(
    deviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const snapshot = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .collection('diagnostics')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  private async getReadingsHistory(
    deviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const snapshot = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .collection('readings')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  private async getAlertsHistory(
    deviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const snapshot = await admin.firestore()
      .collection('devices')
      .doc(deviceId)
      .collection('alerts')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  private calculateStatistics(readings: any[]): any {
    if (readings.length === 0) return null;

    const stats = {
      temperature: { min: Infinity, max: -Infinity, avg: 0 },
      humidity: { min: Infinity, max: -Infinity, avg: 0 },
      pressure: { min: Infinity, max: -Infinity, avg: 0 },
      airQuality: { min: Infinity, max: -Infinity, avg: 0 }
    };

    readings.forEach(reading => {
      ['temperature', 'humidity', 'pressure', 'airQuality'].forEach(metric => {
        const value = reading[metric];
        stats[metric].min = Math.min(stats[metric].min, value);
        stats[metric].max = Math.max(stats[metric].max, value);
        stats[metric].avg += value;
      });
    });

    Object.keys(stats).forEach(metric => {
      stats[metric].avg /= readings.length;
    });

    return stats;
  }

  private summarizeDiagnostics(diagnostics: any[]): any {
    const totalTests = diagnostics.reduce((sum, d) => sum + d.results.length, 0);
    const passedTests = diagnostics.reduce(
      (sum, d) => sum + d.results.filter((r: any) => r.passed).length,
      0
    );

    return {
      totalTests,
      passedTests,
      successRate: (passedTests / totalTests) * 100,
      lastRun: diagnostics[0]?.timestamp
    };
  }

  private summarizeAlerts(alerts: any[]): any {
    return {
      total: alerts.length,
      byLevel: {
        info: alerts.filter(a => a.level === 'info').length,
        warning: alerts.filter(a => a.level === 'warning').length,
        danger: alerts.filter(a => a.level === 'danger').length
      },
      mostRecent: alerts[0]
    };
  }
}