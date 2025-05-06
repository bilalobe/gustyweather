import { KitronikService } from './kitronik.service';
import { SensorReading, WeatherAlert, MonitoringThresholds } from '../types/sensor';
import { EventEmitter } from 'events';
import { Registry, Counter, Gauge, Histogram } from 'prom-client';
import { InfluxDBService } from './influxdb.service';
import { KitronikError } from '../utils/errorHandling';

export class MonitoringService extends EventEmitter {
    private monitoringInterval: NodeJS.Timeout | null = null;
    private thresholds: MonitoringThresholds;
    private alerts: WeatherAlert[] = [];
    private kitronikService: KitronikService;
    private influxService: InfluxDBService;
    private registry: Registry;

    // Prometheus metrics
    private readingsTotal: Counter;
    private readingErrors: Counter;
    private temperature: Gauge;
    private humidity: Gauge;
    private pressure: Gauge;
    private airQuality: Gauge;
    private readingDuration: Histogram;
    private deviceErrors: Counter;
    private activeDevices: Gauge;
    private alertsTriggered: Counter;

    constructor(kitronikService: KitronikService) {
        super();
        this.kitronikService = kitronikService;
        this.influxService = new InfluxDBService();
        this.registry = new Registry();
        this.thresholds = {
            temperature: { min: 15, max: 30 },
            humidity: { min: 30, max: 70 },
            pressure: { min: 980, max: 1020 },
            airQuality: {
                poor: 60,
                hazardous: 30
            }
        };

        // Initialize metrics
        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        this.readingsTotal = new Counter({
            name: 'kitronik_readings_total',
            help: 'Total number of sensor readings',
            labelNames: ['device_id']
        });

        this.readingErrors = new Counter({
            name: 'kitronik_reading_errors_total',
            help: 'Total number of sensor reading errors',
            labelNames: ['device_id', 'error_type']
        });

        this.temperature = new Gauge({
            name: 'kitronik_temperature_celsius',
            help: 'Current temperature reading in Celsius',
            labelNames: ['device_id']
        });

        this.humidity = new Gauge({
            name: 'kitronik_humidity_percent',
            help: 'Current humidity reading in percent',
            labelNames: ['device_id']
        });

        this.pressure = new Gauge({
            name: 'kitronik_pressure_hpa',
            help: 'Current pressure reading in hPa',
            labelNames: ['device_id']
        });

        this.airQuality = new Gauge({
            name: 'kitronik_air_quality_index',
            help: 'Current air quality index',
            labelNames: ['device_id']
        });

        this.readingDuration = new Histogram({
            name: 'kitronik_reading_duration_seconds',
            help: 'Duration of sensor readings in seconds',
            labelNames: ['device_id'],
            buckets: [0.1, 0.5, 1, 2, 5]
        });

        this.deviceErrors = new Counter({
            name: 'kitronik_device_errors_total',
            help: 'Total number of device errors',
            labelNames: ['device_id', 'error_type']
        });

        this.activeDevices = new Gauge({
            name: 'kitronik_active_devices',
            help: 'Number of currently active devices',
        });

        this.alertsTriggered = new Counter({
            name: 'kitronik_alerts_triggered_total',
            help: 'Total number of alerts triggered',
            labelNames: ['device_id', 'alert_type', 'severity']
        });

        // Register all metrics
        this.registry.setDefaultLabels({
            app: 'gustyweather',
            environment: process.env.NODE_ENV || 'development'
        });

        this.registry.registerMetric(this.readingsTotal);
        this.registry.registerMetric(this.readingErrors);
        this.registry.registerMetric(this.temperature);
        this.registry.registerMetric(this.humidity);
        this.registry.registerMetric(this.pressure);
        this.registry.registerMetric(this.airQuality);
        this.registry.registerMetric(this.readingDuration);
        this.registry.registerMetric(this.deviceErrors);
        this.registry.registerMetric(this.activeDevices);
        this.registry.registerMetric(this.alertsTriggered);
    }

    public async startMonitoring(intervalMs = 60000): Promise<void> {
        if (this.monitoringInterval) {
            throw new Error('Monitoring already active');
        }

        await this.kitronikService.validateSensorConnection();
        
        this.monitoringInterval = setInterval(async () => {
            try {
                const data = await this.kitronikService.getEnvironmentalData();
                const alerts = await this.checkConditions(data);
                this.alerts = alerts;
                
                // Emit events for external listeners
                this.emit('reading', data);
                if (alerts.length > 0) {
                    this.emit('alerts', alerts);
                }
                
                // Update outputs based on conditions
                await this.updateOutputs(alerts, data);

                // Update Prometheus metrics
                this.updateMetrics(data);
            } catch (error) {
                this.emit('error', error instanceof Error ? error : new Error(String(error)));
            }
        }, intervalMs);
    }

    public async stopMonitoring(): Promise<void> {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        await this.kitronikService.cleanup();
    }

    private async checkConditions(data: SensorReading): Promise<WeatherAlert[]> {
        const alerts: WeatherAlert[] = [];

        // Check temperature
        if (data.temperature < this.thresholds.temperature.min) {
            alerts.push({
                type: 'temperature',
                level: 'warning',
                message: `Low temperature: ${data.temperature.toFixed(1)}°C`
            });
        } else if (data.temperature > this.thresholds.temperature.max) {
            alerts.push({
                type: 'temperature',
                level: 'danger',
                message: `High temperature: ${data.temperature.toFixed(1)}°C`
            });
        }

        // Check humidity
        if (data.humidity < this.thresholds.humidity.min ||
            data.humidity > this.thresholds.humidity.max) {
            alerts.push({
                type: 'humidity',
                level: 'warning',
                message: `Humidity outside range: ${data.humidity.toFixed(1)}%`
            });
        }

        // Check air quality
        if (data.airQualityIndex < this.thresholds.airQuality.hazardous) {
            alerts.push({
                type: 'airQuality',
                level: 'danger',
                message: `Hazardous air quality: ${data.airQualityIndex}`
            });
        } else if (data.airQualityIndex < this.thresholds.airQuality.poor) {
            alerts.push({
                type: 'airQuality',
                level: 'warning',
                message: `Poor air quality: ${data.airQualityIndex}`
            });
        }

        return alerts;
    }

    private async updateOutputs(alerts: WeatherAlert[], data: SensorReading): Promise<void> {
        try {
            // Update display with alerts and current readings
            const displayPatterns = [{
                text: alerts.length > 0 ? [
                    'Weather Alerts:',
                    ...alerts.map(alert => alert.message)
                ] : [
                    'Current Conditions:',
                    `Temperature: ${data.temperature.toFixed(1)}°C`,
                    `Humidity: ${data.humidity.toFixed(1)}%`,
                    `Air Quality: ${data.airQualityIndex}`
                ]
            }];

            await this.kitronikService.updateDisplay(displayPatterns);

            // Set LED patterns based on alert levels
            const ledPatterns = alerts.map((alert, index) => ({
                index,
                r: alert.level === 'danger' ? 255 : alert.level === 'warning' ? 255 : 0,
                g: alert.level === 'info' ? 255 : 0,
                b: 0
            }));

            await this.kitronikService.setLEDPattern(ledPatterns);

            // Control ventilation based on air quality
            if (alerts.some(a => a.type === 'airQuality')) {
                await this.kitronikService.setHighPowerOutput(0, true);
            }

            // Update servo position based on conditions
            const humidityAngle = Math.round((data.humidity / 100) * 180);
            await this.kitronikService.setServoPosition(0, humidityAngle);
        } catch (error) {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }

    private updateMetrics(data: SensorReading): void {
        const deviceId = 'default_device'; // Replace with actual device ID if available

        this.readingsTotal.inc({ device_id: deviceId });
        this.temperature.set({ device_id: deviceId }, data.temperature);
        this.humidity.set({ device_id: deviceId }, data.humidity);
        this.pressure.set({ device_id: deviceId }, data.pressure);
        this.airQuality.set({ device_id: deviceId }, data.airQualityIndex);
    }

    public getAlerts(): WeatherAlert[] {
        return [...this.alerts];
    }

    public updateThresholds(newThresholds: Partial<MonitoringThresholds>): void {
        this.thresholds = {
            ...this.thresholds,
            ...newThresholds
        };
    }

    public async cleanup(): Promise<void> {
        await this.stopMonitoring();
        await this.influxService.cleanup();
        this.registry.clear();
    }

    getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}