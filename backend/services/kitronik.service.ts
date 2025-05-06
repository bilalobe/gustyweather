import { SensorInitialization, measureData } from '../../Kitronik5038Port/lib/SensorInitialization';
import { I2CCommunication } from '../../Kitronik5038Port/lib/I2CCommunication';
import { SensorData, KitronikConfig, KitronikStatus, EnvironmentalData, CalibrationResult } from '../types/sensor';
import { BaselineCalculation } from '../../Kitronik5038Port/lib/BaselineCalculation';
import { CompensationCalculations } from '../../Kitronik5038Port/lib/CompensationCalculations';
import { KitronikBME688 } from '../../Kitronik5038Port/lib/KitronikBME688';
import { DataReading } from '../../Kitronik5038Port/lib/DataReading';
import { SensorError } from '../../Kitronik5038Port/lib/err/SensorError';
import { BaselineStorage } from '../../Kitronik5038Port/lib/data/BaselineStorage';
import { KitronikZIPLEDs } from '../../Kitronik5038Port/lib/KitronikZIPLEDs';
import { KitronikRTC } from '../../Kitronik5038Port/lib/KitronikRTC';
import { KitronikGPIO } from '../../Kitronik5038Port/lib/KitronikGPIO';
import { KitronikHighPowerOut } from '../../Kitronik5038Port/lib/KitronikHighPowerOut';

interface OutputStatus {
    displayActive: boolean;
    ledsActive: boolean;
    highPowerState: boolean[];
    servoPositions: number[];
    lastUpdate: string;
}

interface DisplayPattern {
    text: string[];
    shape?: {
        type: 'rectangle' | 'circle' | 'line';
        position: { x: number; y: number };
        dimensions: { width: number; height: number } | number;
    };
}

export class KitronikService {
    private sensorInit: SensorInitialization;
    private i2cComm: I2CCommunication;
    private status: KitronikStatus;
    private readingInterval: NodeJS.Timeout | null = null;
    private sensor: KitronikBME688;
    private baselineCalc: BaselineCalculation;
    private compensationCalc: CompensationCalculations;
    private baselineStorage: BaselineStorage;
    private zipLeds: KitronikZIPLEDs;
    private rtc: KitronikRTC;
    private gpio: KitronikGPIO;
    private powerOut: KitronikHighPowerOut;
    private outputStatus: OutputStatus;

    constructor(config?: KitronikConfig) {
        this.i2cComm = new I2CCommunication(0x77);
        this.sensorInit = new SensorInitialization(this.i2cComm);
        this.status = {
            isInitialized: false,
            lastReadingTime: new Date().toISOString(),
            sensorMode: config?.iaqMode || 'static',
            calibrationStatus: false
        };
        this.sensor = new KitronikBME688();
        this.baselineCalc = new BaselineCalculation();
        this.compensationCalc = new CompensationCalculations();
        this.baselineStorage = new BaselineStorage();
        this.zipLeds = new KitronikZIPLEDs();
        this.rtc = new KitronikRTC();
        this.gpio = new KitronikGPIO();
        this.powerOut = new KitronikHighPowerOut();
        this.outputStatus = {
            displayActive: false,
            ledsActive: false,
            highPowerState: [false, false, false, false],
            servoPositions: [0, 0],
            lastUpdate: new Date().toISOString()
        };
        this.initialize(config);
        this.initializeStatusLEDs();
        this.initializeGPIO();
    }

    private async initialize(config?: KitronikConfig) {
        try {
            const initResult = await this.sensorInit.initialize({
                gasSettings: {
                    targetTemp: 350,
                    heatDuration: 150,
                    ambientTemp: 25
                }
            });

            this.status.isInitialized = initResult.success;
            this.status.calibrationStatus = initResult.success;

            if (config?.samplingInterval) {
                this.startContinuousReading(config.samplingInterval);
            }
        } catch (error) {
            console.error('Failed to initialize BME688:', error);
            throw error;
        }
    }

    private async initializeStatusLEDs(): Promise<void> {
        // Set up status indicators
        await this.zipLeds.setColor(0, 'blue');    // Power indicator
        await this.zipLeds.setColor(1, 'yellow');  // Sensor status
        await this.zipLeds.setColor(2, 'green');   // Data logging status
        await this.zipLeds.show();
    }

    private async initializeGPIO(): Promise<void> {
        // Set up GPIO pins for external sensors and controls
        await this.gpio.setupPin(0, 'input');  // External trigger
        await this.gpio.setupPin(1, 'output'); // Status LED
        await this.gpio.setupPin(2, 'input');  // Door sensor
        await this.powerOut.setupOutput(0);    // External fan control
    }

    startContinuousReading(interval: number = 1000): void {
        if (this.readingInterval) {
            clearInterval(this.readingInterval);
        }

        this.readingInterval = setInterval(async () => {
            try {
                const data = await this.readSensorData();
                console.log('Sensor reading:', data);
            } catch (error) {
                console.error('Error in continuous reading:', error);
            }
        }, interval);
    }

    stopContinuousReading(): void {
        if (this.readingInterval) {
            clearInterval(this.readingInterval);
            this.readingInterval = null;
        }
    }

    async readSensorData(): Promise<SensorData> {
        if (!this.status.isInitialized) {
            throw new Error('Sensor not initialized');
        }

        const reading = await measureData();
        const now = new Date();
        this.status.lastReadingTime = now.toISOString();

        return {
            timestamp: now.toISOString(),
            ...reading,
            ...this.sensorInit.getCalibrationData()
        };
    }

    async readEnvironmentalData(): Promise<EnvironmentalData> {
        const baseData = await this.readSensorData();
        
        return {
            ...baseData,
            airQualityIndex: this.sensorInit.getAirQualityScore(),
            airQualityAccuracy: this.status.calibrationStatus ? 3 : 1,
            co2Equivalent: this.sensorInit.readeCO2(),
            vocEquivalent: this.calculateVOC(),
            ambientTemperature: this.sensorInit.readTemperature()
        };
    }

    async calibrateSensor(): Promise<CalibrationResult> {
        try {
            let calibrationSuccess = false;
            
            await this.sensorInit.calcBaselines({
                clear: () => console.log('Starting calibration...'),
                print: (text: string) => console.log(`Calibration: ${text}`)
            }, true);

            this.status.calibrationStatus = true;
            calibrationSuccess = true;

            return {
                success: calibrationSuccess,
                baselineTemp: this.sensorInit.readTemperature(),
                baselineHumidity: this.sensorInit.readHumidity(),
                baselineResistance: this.sensorInit.readGasRes(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.status.calibrationStatus = false;
            throw error;
        }
    }

    private calculateVOC(): number {
        const gasResistance = this.sensorInit.readGasRes();
        const humidity = this.sensorInit.readHumidity();
        // VOC calculation based on gas resistance and humidity
        return Math.floor((1000000 / gasResistance) * (humidity / 50));
    }

    async configureHeater(targetTemp: number = 320, duration: number = 150): Promise<void> {
        try {
            this.sensorInit.setupGasSensor(targetTemp, duration);
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Heater configuration failed:', error);
            throw error;
        }
    }

    getStatus(): KitronikStatus {
        return { ...this.status };
    }

    public async getEnvironmentalData(): Promise<DataReading> {
        const rawReading = await this.sensor.readSensorData();
        const compensated = this.compensationCalc.applyCompensation(rawReading);
        const baselined = this.baselineCalc.applyBaseline(compensated);
        return baselined;
    }

    public async calibrateSensor(options: { forcedRun: boolean; displayProgress: boolean }): Promise<void> {
        await this.baselineCalc.calibrate(this.sensor, options.forcedRun, options.displayProgress);
    }

    public async getSensorStatus(): Promise<SensorStatus> {
        try {
            const baseline = await this.baselineStorage.loadBaseline();
            const reading = await this.sensor.readSensorData();
            
            return {
                isCalibrated: baseline !== null,
                lastCalibration: baseline?.timestamp || null,
                isReading: Boolean(reading),
                errors: []
            };
        } catch (error) {
            if (error instanceof SensorError) {
                return {
                    isCalibrated: false,
                    lastCalibration: null,
                    isReading: false,
                    errors: [error.message]
                };
            }
            throw error;
        }
    }

    public async validateSensorConnection(): Promise<boolean> {
        try {
            await this.sensor.validateConnection();
            return true;
        } catch (error) {
            if (error instanceof SensorError) {
                return false;
            }
            throw error;
        }
    }

    public async updateStatusLEDs(status: SensorStatus): Promise<void> {
        // Update LED colors based on status
        if (!status.isCalibrated) {
            await this.zipLeds.setColor(1, 'red');
        } else if (status.errors.length > 0) {
            await this.zipLeds.setColor(1, 'orange');
        } else {
            await this.zipLeds.setColor(1, 'green');
        }

        if (status.isReading) {
            await this.zipLeds.setColor(2, 'blue');
        } else {
            await this.zipLeds.setColor(2, 'yellow');
        }

        await this.zipLeds.show();
    }

    public getTimestamp(): Date {
        return this.rtc.getDateTime();
    }

    public async monitorExternalTriggers(): Promise<void> {
        // Monitor door sensor
        if (await this.gpio.readPin(2)) {
            await this.powerOut.setOutput(0, true); // Turn on ventilation
            await this.startContinuousReading();
        } else {
            await this.powerOut.setOutput(0, false);
            await this.stopContinuousReading();
        }

        // Check external trigger
        if (await this.gpio.readPin(0)) {
            await this.calibrateSensor({ forcedRun: true, displayProgress: true });
        }
    }

    public async setPowerState(active: boolean): Promise<void> {
        await this.gpio.writePin(1, active);
        if (!active) {
            await this.powerOut.setAllOutputs(false);
        }
    }

    public async updateDisplay(patterns: DisplayPattern[]): Promise<void> {
        try {
            await this.oled.initialize();
            await this.oled.clear();

            for (const pattern of patterns) {
                if (pattern.text) {
                    pattern.text.forEach((line, i) => {
                        this.oled.writeTextToLine(line, i);
                    });
                }

                if (pattern.shape) {
                    this.drawShape(pattern.shape);
                }
            }

            await this.oled.show();
            this.outputStatus.displayActive = true;
            this.outputStatus.lastUpdate = new Date().toISOString();
        } catch (error) {
            console.error('Display update error:', error instanceof Error ? error.message : String(error));
            this.outputStatus.displayActive = false;
            throw new Error('Failed to update display');
        }
    }

    private drawShape(shape: DisplayPattern['shape']): void {
        if (!shape) return;

        try {
            switch (shape.type) {
                case 'rectangle':
                    if (typeof shape.dimensions === 'object') {
                        this.oled.drawRect(
                            shape.position.x,
                            shape.position.y,
                            shape.dimensions.width,
                            shape.dimensions.height
                        );
                    }
                    break;
                case 'circle':
                    if (typeof shape.dimensions === 'number') {
                        this.drawCircle(
                            shape.position.x,
                            shape.position.y,
                            shape.dimensions
                        );
                    }
                    break;
                case 'line':
                    if (typeof shape.dimensions === 'object') {
                        this.oled.drawLine(
                            shape.position.x,
                            shape.position.y,
                            shape.position.x + shape.dimensions.width,
                            shape.position.y + shape.dimensions.height
                        );
                    }
                    break;
            }
        } catch (error) {
            console.error('Shape drawing error:', error instanceof Error ? error.message : String(error));
        }
    }

    private drawCircle(x: number, y: number, radius: number): void {
        const segments = 36;
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * 2 * Math.PI;
            const angle2 = ((i + 1) / segments) * 2 * Math.PI;

            const x1 = x + Math.round(radius * Math.cos(angle1));
            const y1 = y + Math.round(radius * Math.sin(angle1));
            const x2 = x + Math.round(radius * Math.cos(angle2));
            const y2 = y + Math.round(radius * Math.sin(angle2));

            this.oled.drawLine(x1, y1, x2, y2);
        }
    }

    public async setLEDPattern(pattern: LEDPattern[]): Promise<void> {
        try {
            for (const led of pattern) {
                if (!this.isValidLEDPattern(led)) {
                    throw new Error(`Invalid LED pattern: ${JSON.stringify(led)}`);
                }
                await this.zipLeds.setPixel(led.index, led.r, led.g, led.b);
            }
            await this.zipLeds.show();
            this.outputStatus.ledsActive = true;
            this.outputStatus.lastUpdate = new Date().toISOString();
        } catch (error) {
            console.error('LED pattern error:', error instanceof Error ? error.message : String(error));
            this.outputStatus.ledsActive = false;
            await this.zipLeds.clear();
            await this.zipLeds.show();
            throw new Error('Failed to set LED pattern');
        }
    }

    private isValidLEDPattern(pattern: LEDPattern): boolean {
        return (
            typeof pattern.index === 'number' &&
            pattern.index >= 0 &&
            pattern.index < 8 &&
            [pattern.r, pattern.g, pattern.b].every(
                value => Number.isInteger(value) && value >= 0 && value <= 255
            )
        );
    }

    public async setHighPowerOutput(index: number, state: boolean): Promise<void> {
        try {
            if (index < 0 || index >= 4) {
                throw new Error(`Invalid high power output index: ${index}`);
            }
            
            if (state) {
                await this.powerOut.turnOn(index);
            } else {
                await this.powerOut.turnOff(index);
            }
            
            this.outputStatus.highPowerState[index] = state;
            this.outputStatus.lastUpdate = new Date().toISOString();
        } catch (error) {
            console.error(`High power output error for index ${index}:`, error instanceof Error ? error.message : String(error));
            throw new Error(`Failed to set high power output ${index}`);
        }
    }

    public async setServoPosition(index: number, angle: number): Promise<void> {
        try {
            if (index < 0 || index >= 2) {
                throw new Error(`Invalid servo index: ${index}`);
            }
            if (angle < 0 || angle > 180) {
                throw new Error(`Invalid servo angle: ${angle}`);
            }
            
            await this.servo.setAngle(angle);
            this.outputStatus.servoPositions[index] = angle;
            this.outputStatus.lastUpdate = new Date().toISOString();
        } catch (error) {
            console.error(`Servo control error for index ${index}:`, error instanceof Error ? error.message : String(error));
            throw new Error(`Failed to set servo ${index} position`);
        }
    }

    public getOutputStatus(): OutputStatus {
        return { ...this.outputStatus };
    }

    public async cleanup(): Promise<void> {
        try {
            // Stop all outputs
            await this.oled.clear();
            await this.oled.show();
            await this.zipLeds.clear();
            await this.zipLeds.show();
            this.powerOut.turnOff();
            
            // Update status
            this.outputStatus = {
                displayActive: false,
                ledsActive: false,
                highPowerState: [false, false, false, false],
                servoPositions: [0, 0],
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Cleanup error:', error instanceof Error ? error.message : String(error));
            throw new Error('Failed to cleanup outputs');
        }
    }
}
