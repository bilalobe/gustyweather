import express, { Request, Response } from 'express';
import { SensorController } from '../controllers/sensor.controller';
import { DiagnosticController } from '../controllers/diagnostic.controller';
import { MonitoringService } from '../services/monitoring.service';
import { KitronikService } from '../services/kitronik.service';
import { withRetry } from '../utils/errorHandling';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateDevice, DeviceRequest } from '../middleware/device.middleware';
import { validateSession } from '../middleware/session.middleware';

const router = express.Router();
const kitronikService = new KitronikService();
const monitoringService = new MonitoringService(kitronikService);
const sensorController = new SensorController(kitronikService, monitoringService);
const diagnosticController = new DiagnosticController(monitoringService);

// Public routes - require only basic authentication
router.get('/readings/history', requireAuth, (req: AuthenticatedRequest, res) => 
  sensorController.getSensorData(req, res));
router.get('/readings/current', requireAuth, (req: AuthenticatedRequest, res) => 
  sensorController.readSensorData(req, res));
router.get('/status', requireAuth, (req: AuthenticatedRequest, res) => 
  sensorController.getSensorStatus(req, res));

// Device-specific routes - require device validation
router.get('/environmental', [requireAuth, validateDevice], (req: DeviceRequest, res) => 
  sensorController.getEnvironmentalData(req, res));

router.post('/monitoring/start', [requireAuth, validateDevice], (req: DeviceRequest, res) => 
  sensorController.startMonitoring(req, res));
router.post('/monitoring/stop', [requireAuth, validateDevice], (req: DeviceRequest, res) => 
  sensorController.stopMonitoring(req, res));
router.post('/monitoring/thresholds', [requireAuth, validateDevice], (req: DeviceRequest, res) => 
  sensorController.setMonitoringThresholds(req, res));

// Admin routes - require admin privileges
router.post('/calibrate', [requireAuth, requireAdmin], (req: AuthenticatedRequest, res) => 
  sensorController.calibrateSensor(req, res));
router.post('/diagnostics/run', [requireAuth, requireAdmin], (req: AuthenticatedRequest, res) => 
  diagnosticController.runDiagnostics(req, res));
router.post('/diagnostics/self-test', [requireAuth, requireAdmin], (req: AuthenticatedRequest, res) => 
  diagnosticController.performSelfTest(req, res));

// Output control endpoints - require device validation and active session
router.post('/outputs/display', [requireAuth, validateDevice, validateSession], async (req: DeviceRequest, res) => {
    try {
        await withRetry(() => kitronikService.updateDisplay(req.body.patterns));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to update display'
        });
    }
});

router.post('/outputs/leds', [requireAuth, validateDevice, validateSession], async (req: DeviceRequest, res) => {
    try {
        await withRetry(() => kitronikService.setLEDPattern(req.body.pattern));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to set LED pattern'
        });
    }
});

router.post('/outputs/power/:index', [requireAuth, validateDevice, validateSession], async (req: DeviceRequest, res) => {
    try {
        const index = parseInt(req.params.index);
        await withRetry(() => kitronikService.setHighPowerOutput(index, req.body.state));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to set high power output'
        });
    }
});

router.post('/outputs/servo/:index', [requireAuth, validateDevice, validateSession], async (req: DeviceRequest, res) => {
    try {
        const index = parseInt(req.params.index);
        await withRetry(() => kitronikService.setServoPosition(index, req.body.angle));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to set servo position'
        });
    }
});

router.get('/outputs/status', [requireAuth, validateDevice], async (req: DeviceRequest, res) => {
    try {
        const status = await withRetry(() => Promise.resolve(kitronikService.getOutputStatus()));
        res.json(status);
    } catch (error) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to get output status'
        });
    }
});

// Error handling for uncaught errors
router.use((error: Error, req: Request, res: Response, next: Function) => {
    console.error('Unhandled error in sensor routes:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

export default router;