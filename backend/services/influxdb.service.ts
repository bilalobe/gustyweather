import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { KitronikError } from '../utils/errorHandling';
import { SensorData } from '../types/sensor';
import { DataReading } from '../../Kitronik5038Port/lib/DataReading';

export class InfluxDBService {
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private org: string;
  private bucket: string;

  constructor() {
    const url = process.env.INFLUXDB_URL;
    const token = process.env.INFLUXDB_TOKEN;
    this.org = process.env.INFLUXDB_ORG || '';
    this.bucket = process.env.INFLUXDB_BUCKET || '';

    if (!url || !token) {
      throw new Error('InfluxDB configuration missing');
    }

    const influxDB = new InfluxDB({ url, token });
    this.writeApi = influxDB.getWriteApi(this.org, this.bucket, 'ms');
    this.queryApi = influxDB.getQueryApi(this.org);
  }

  async writeSensorData(deviceId: string, data: SensorData): Promise<void> {
    try {
      const point = new Point('environmental_readings')
        .tag('deviceId', deviceId)
        .floatField('temperature', data.temperature)
        .floatField('humidity', data.humidity)
        .floatField('pressure', data.pressure)
        .intField('airQuality', data.airQuality)
        .timestamp(new Date(data.timestamp));

      await this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      throw new KitronikError(
        'Failed to write sensor data to InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async getDeviceReadings(
    deviceId: string,
    start: Date,
    end: Date = new Date()
  ): Promise<SensorData[]> {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "environmental_readings")
        |> filter(fn: (r) => r["deviceId"] == "${deviceId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    try {
      const results: SensorData[] = [];
      for await (const {values, tableMeta} of this.queryApi.iterateRows(query)) {
        const row = tableMeta.toObject(values);
        results.push({
          temperature: row.temperature,
          humidity: row.humidity,
          pressure: row.pressure,
          airQuality: row.airQuality,
          timestamp: row._time
        });
      }
      return results;
    } catch (error) {
      throw new KitronikError(
        'Failed to query sensor data from InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async getAggregatedStats(
    deviceId: string,
    interval: string,
    start: Date,
    end: Date = new Date()
  ): Promise<any[]> {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "environmental_readings")
        |> filter(fn: (r) => r["deviceId"] == "${deviceId}")
        |> aggregateWindow(every: ${interval}, fn: mean)
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;

    try {
      const results = [];
      for await (const {values, tableMeta} of this.queryApi.iterateRows(query)) {
        results.push(tableMeta.toObject(values));
      }
      return results;
    } catch (error) {
      throw new KitronikError(
        'Failed to query aggregated stats from InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async getAlerts(
    deviceId: string,
    severity: string[] = ['warning', 'critical'],
    start: Date,
    end: Date = new Date()
  ): Promise<any[]> {
    const severityFilter = severity.map(s => `r["severity"] == "${s}"`).join(' or ');
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})
        |> filter(fn: (r) => r["_measurement"] == "alerts")
        |> filter(fn: (r) => r["deviceId"] == "${deviceId}")
        |> filter(fn: (r) => ${severityFilter})
    `;

    try {
      const results = [];
      for await (const {values, tableMeta} of this.queryApi.iterateRows(query)) {
        results.push(tableMeta.toObject(values));
      }
      return results;
    } catch (error) {
      throw new KitronikError(
        'Failed to query alerts from InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async writeAlert(
    deviceId: string,
    type: string,
    severity: string,
    message: string,
    value?: number
  ): Promise<void> {
    try {
      const point = new Point('alerts')
        .tag('deviceId', deviceId)
        .tag('type', type)
        .tag('severity', severity)
        .stringField('message', message);

      if (value !== undefined) {
        point.floatField('value', value);
      }

      await this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      throw new KitronikError(
        'Failed to write alert to InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async writeDeviceStatus(
    deviceId: string,
    status: 'active' | 'inactive' | 'error',
    details?: string
  ): Promise<void> {
    try {
      const point = new Point('device_status')
        .tag('deviceId', deviceId)
        .tag('status', status)
        .timestamp(new Date());

      if (details) {
        point.stringField('details', details);
      }

      await this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      throw new KitronikError(
        'Failed to write device status to InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async getDeviceStatus(deviceId: string): Promise<any> {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r["_measurement"] == "device_status")
        |> filter(fn: (r) => r["deviceId"] == "${deviceId}")
        |> last()
    `;

    try {
      const results = [];
      for await (const {values, tableMeta} of this.queryApi.iterateRows(query)) {
        results.push(tableMeta.toObject(values));
      }
      return results[0] || null;
    } catch (error) {
      throw new KitronikError(
        'Failed to query device status from InfluxDB',
        'DATABASE_ERROR',
        error
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.writeApi.close();
    } catch (error) {
      console.error('Error closing InfluxDB connection:', error);
    }
  }
}
