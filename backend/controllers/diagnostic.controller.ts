import { Request, Response } from 'express';
import { DiagnosticService } from '../services/diagnostic.service';
import { ValidationService } from '../services/validation.service';
import { KitronikError } from '../utils/errorHandling';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DeviceRequest } from '../middleware/device.middleware';

export class DiagnosticController {
  private diagnosticService: DiagnosticService;

  constructor(diagnosticService: DiagnosticService) {
    this.diagnosticService = diagnosticService;
  }

  async runDiagnostics = async (req: DeviceRequest, res: Response) => {
    try {
      const deviceId = req.deviceInfo?.id;
      if (!deviceId) {
        throw new KitronikError('Device ID required', 'VALIDATION_ERROR');
      }

      const results = await this.diagnosticService.runFullDiagnostics(
        deviceId,
        req.user?.uid as string
      );

      res.json({ results });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Diagnostic error:', error);
        res.status(500).json({ error: 'Failed to run diagnostics' });
      }
    }
  };

  async performSelfTest = async (req: DeviceRequest, res: Response) => {
    try {
      const deviceId = req.deviceInfo?.id;
      if (!deviceId) {
        throw new KitronikError('Device ID required', 'VALIDATION_ERROR');
      }

      const testResults = await this.diagnosticService.performSelfTest(
        deviceId,
        req.user?.uid as string
      );

      res.json({ testResults });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Self-test error:', error);
        res.status(500).json({ error: 'Failed to perform self-test' });
      }
    }
  };

  async validateSensorReadings = async (req: DeviceRequest, res: Response) => {
    try {
      const { readings } = req.body;
      const deviceId = req.deviceInfo?.id;

      if (!deviceId) {
        throw new KitronikError('Device ID required', 'VALIDATION_ERROR');
      }

      ValidationService.validateSensorData(readings);
      const validationResults = await this.diagnosticService.validateReadings(
        deviceId,
        readings
      );

      res.json({ validationResults });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Failed to validate readings' });
      }
    }
  };

  async checkDeviceHealth = async (req: DeviceRequest, res: Response) => {
    try {
      const deviceId = req.deviceInfo?.id;
      if (!deviceId) {
        throw new KitronikError('Device ID required', 'VALIDATION_ERROR');
      }

      const healthStatus = await this.diagnosticService.checkDeviceHealth(
        deviceId,
        req.user?.uid as string
      );

      res.json({ healthStatus });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Health check error:', error);
        res.status(500).json({ error: 'Failed to check device health' });
      }
    }
  };

  async generateDiagnosticReport = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deviceId, startDate, endDate } = req.query;
      
      if (!deviceId || typeof deviceId !== 'string') {
        throw new KitronikError('Valid device ID required', 'VALIDATION_ERROR');
      }

      const report = await this.diagnosticService.generateReport(
        deviceId,
        req.user?.uid as string,
        {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        }
      );

      res.json({ report });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate diagnostic report' });
      }
    }
  };

  async verifyCalibration = async (req: DeviceRequest, res: Response) => {
    try {
      const deviceId = req.deviceInfo?.id;
      if (!deviceId) {
        throw new KitronikError('Device ID required', 'VALIDATION_ERROR');
      }

      const calibrationStatus = await this.diagnosticService.verifyCalibration(
        deviceId,
        req.user?.uid as string
      );

      res.json({ calibrationStatus });
    } catch (error) {
      if (error instanceof KitronikError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Calibration verification error:', error);
        res.status(500).json({ error: 'Failed to verify calibration' });
      }
    }
  };
}