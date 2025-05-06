import { Request, Response } from 'express';
import Joi from 'joi';
import { InfluxDBService } from '../services/influxdb.service';
import { KitronikService } from '../services/kitronik.service';
import { SensorData } from '../types/sensor';
import { validate } from '../lib/validation/decorators';
import { SensorError } from '../lib/err/SensorError';
import { DataValidation } from '../lib/validation/DataValidation';
import { AirQualityCalculator } from '../../Kitronik5038Port/lib/AirQualityCalculation';
import { KitronikOLED } from '../../Kitronik5038Port/lib/KitronikOLED';
import { KitronikBuzzer } from '../../Kitronik5038Port/lib/KitronikBuzzer';
import { KitronikZIPLEDs } from '../../Kitronik5038Port/lib/KitronikZIPLEDs';
import { KitronikRTC } from '../../Kitronik5038Port/lib/KitronikRTC';
import { BaselineService } from '../services/baseline.service';
import { ValidationService } from '../services/validation.service';
import { MonitoringService } from '../services/monitoring.service';

export class SensorController {
    private influxDBService: InfluxDBService;
    private kitronikService: KitronikService;
    private sensorDataSchema: Joi.ObjectSchema;
    private airQualityCalc: AirQualityCalculator;
    private readingInterval: NodeJS.Timeout | null = null;
    private oled: KitronikOLED;
    private buzzer: KitronikBuzzer;
    private rtc: KitronikRTC;
    private baselineService: BaselineService;
    private validationService: ValidationService;
    private monitoringService: MonitoringService;
    private zipLeds: KitronikZIPLEDs;

    constructor() {
        this.influxDBService = new InfluxDBService();
        this.kitronikService = new KitronikService({
            iaqMode: 'static',
            samplingInterval: 1000
        });
        this.sensorDataSchema = Joi.object({
            timestamp: Joi.date().iso().required(),
            temperature: Joi.number().required(),
            pressure: Joi.number().required(),
            humidity: Joi.number().required(),
            gasResistance: Joi.number().required(),
            iaqPercent: Joi.number().required(),
            iaqScore: Joi.number().required(),
            eCO2Value: Joi.number().required(),
        });
        this.airQualityCalc = new AirQualityCalculator();
        this.oled = new KitronikOLED();
        this.buzzer = new KitronikBuzzer();
        this.rtc = new KitronikRTC();
        this.baselineService = new BaselineService(this.influxDBService);
        this.validationService = new ValidationService();
        this.monitoringService = new MonitoringService();
        this.zipLeds = new KitronikZIPLEDs();
        this.setupMonitoringEvents();
    }

    private setupMonitoringEvents(): void {
        this.monitoringService.on('reading', async (reading) => {
            try {
                await this.influxDBService.writeSensorReading(reading);
                
                // Update OLED display with latest reading
                this.oled.clear();
                this.oled.write(`T: ${reading.temperature.toFixed(1)}°C`, { row: 1 });
                this.oled.write(`H: ${reading.humidity.toFixed(1)}%`, { row: 2 });
                this.oled.write(`AQI: ${reading.airQualityIndex}`, { row: 3 });
                this.oled.update();
            } catch (error) {
                console.error('Error handling sensor reading:', error);
            }
        });

        this.monitoringService.on('alert', ({ type, value }) => {
            // Visual and audio alert
            this.buzzer.tone(880);
            setTimeout(() => this.buzzer.noTone(), 200);
            
            this.zipLeds.setPixelColor(1, '#FF0000');
            this.zipLeds.update();
            
            // Reset LED after 5 seconds
            setTimeout(() => {
                this.zipLeds.setPixelColor(1, '#00FF00');
                this.zipLeds.update();
            }, 5000);

            console.log(`Alert: ${type} = ${value}`);
        });

        this.monitoringService.on('error', (error) => {
            console.error('Monitoring error:', error);
            this.zipLeds.setPixelColor(1, '#FFA500');
            this.zipLeds.update();
        });
    }

    async storeSensorData(req: Request, res: Response) {
        try {
            const { error, value: sensorData } = this.sensorDataSchema.validate(req.body, { abortEarly: false });

            if (error) {
                const errorDetails = error.details.map((detail) => detail.message);
                console.error('Validation errors:', errorDetails);
                await this.influxDBService.writeErrorLog(errorDetails);
                return res.status(400).json({ error: errorDetails });
            }

            await this.influxDBService.writeSensorData(sensorData as SensorData);
            res.status(200).send('Sensor data received and stored.');
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Error processing sensor data.');
        }
    }

    async getSensorData(req: Request, res: Response) {
        try {
            const rows = await this.influxDBService.queryRecentSensorData();
            const sensorData = rows.map(row => ({
                time: new Date(row._time).getTime(),
                temperature: parseFloat(row._value) || 0,
                pressure: parseFloat(row.pressure) || 0,
                humidity: parseFloat(row.humidity) || 0,
                gasResistance: parseFloat(row.gasResistance) || 0,
                iaqPercent: parseFloat(row.iaqPercent) || 0,
                iaqScore: parseFloat(row.iaqScore) || 0,
                eCO2Value: parseFloat(row.eCO2Value) || 0
            }));
            
            res.json({ sensorData });
        } catch (error) {
            console.error("Error querying sensor data:", error);
            res.status(500).json({ error: 'Error querying sensor data.' });
        }
    }

    // Add new method for direct sensor reading
    @validate(DataValidation.validateSensorReading)
    public async readSensorData(req: Request, res: Response): Promise<void> {
        try {
            const reading = await this.kitronikService.getSensorData();
            this.validationService.validateEnvironmentalData(reading);
            res.json(reading);
        } catch (error) {
            if (error instanceof SensorError) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    public async startContinuousReading(req: Request, res: Response): Promise<void> {
        try {
            const interval = Number(req.query.interval) || 1000;
            await this.monitoringService.startMonitoring(interval);
            res.json({ success: true, interval });
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to start monitoring',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    public async stopContinuousReading(_req: Request, res: Response): Promise<void> {
        try {
            await this.monitoringService.stopMonitoring();
            this.oled.clear();
            this.oled.update();
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to stop monitoring',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // Add method to get sensor status
    async getSensorStatus(_req: Request, res: Response) {
        try {
            const status = this.kitronikService.getStatus();
            res.json({ status });
        } catch (error) {
            console.error('Error getting sensor status:', error);
            res.status(500).json({ error: 'Error getting sensor status' });
        }
    }

    async getEnvironmentalData(_req: Request, res: Response) {
        try {
            const envData = await this.kitronikService.readEnvironmentalData();
            await this.influxDBService.writeSensorData(envData);
            
            res.json({
                data: envData,
                status: this.kitronikService.getStatus(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(503).json({
                error: 'Environmental data reading failed',
                details: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }

    @validate(DataValidation.validateCalibrationRequest)
    public async calibrateSensor(req: Request, res: Response): Promise<void> {
        try {
            this.validationService.validateCalibrationConfig(req.body);
            const result = await this.kitronikService.calibrateSensor(req.body);
            res.json(result);
        } catch (error) {
            if (error instanceof SensorError) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Calibration failed' });
            }
        }
    }

    public async setAlertThresholds(req: Request, res: Response): Promise<void> {
        try {
            this.validationService.validateAlertThresholds(req.body);
            
            for (const [type, value] of Object.entries(req.body)) {
                this.monitoringService.setAlertThreshold(type, value as number);
            }
            
            res.json({ success: true, thresholds: req.body });
        } catch (error) {
            res.status(400).json({ 
                error: 'Invalid alert thresholds',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    public async getHardwareStatus(req: Request, res: Response): Promise<void> {
        try {
            const status = await this.kitronikService.getSensorStatus();
            const timestamp = await this.rtc.getTime();
            const baselines = await this.kitronikService.getBaselines();
            
            res.json({
                status,
                timestamp,
                lastBaselines: baselines.slice(-5),
                calibrationNeeded: baselines.length === 0 || 
                    (Date.now() - baselines[0].timestamp > 24 * 60 * 60 * 1000)
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get hardware status' });
        }
    }

    public async displayMessage(req: Request, res: Response): Promise<void> {
        const { message, line = 1, duration = 5000 } = req.body;
        
        try {
            this.oled.clear();
            this.oled.write(message, { row: line });
            this.oled.update();
            
            // Clear after duration if specified
            if (duration > 0) {
                setTimeout(() => {
                    this.oled.clear();
                    this.oled.update();
                }, duration);
            }
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to display message' });
        }
    }

    public async resetHardware(req: Request, res: Response): Promise<void> {
        try {
            await this.kitronikService.setPowerState(false);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.kitronikService.setPowerState(true);
            await this.kitronikService.initializeGPIO();
            
            // Re-initialize display with status
            const status = await this.kitronikService.getSensorStatus();
            await this.kitronikService.updateStatusLEDs(status);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Hardware reset failed' });
        }
    }

    public async setPowerState(req: Request, res: Response): Promise<void> {
        const { active } = req.body;
        
        try {
            await this.kitronikService.setPowerState(active);
            res.json({ success: true, state: active });
        } catch (error) {
            res.status(500).json({ error: 'Failed to set power state' });
        }
    }
}
