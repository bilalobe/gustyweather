import express, { Request, Response } from 'express';
import next from 'next';
import bodyParser from 'body-parser';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// InfluxDB setup
const influxDBUrl = process.env.INFLUXDB_URL || '';
const influxDBToken = process.env.INFLUXDB_TOKEN || '';
const client = new InfluxDB({ url: influxDBUrl, token: influxDBToken });
const org = process.env.INFLUXDB_ORG || '';
const bucket = process.env.INFLUXDB_BUCKET || '';

interface SensorData {
  timestamp: string;
  temperature: number;
  pressure: number;
  humidity: number;
  gasResistance: number;
  iaqPercent: number;
  iaqScore: number;
  eCO2Value: number;
}

const writeSensorData = async (sensorData: SensorData) => {
  const writeApi = client.getWriteApi(org, bucket);
  const point = new Point('sensor_readings')
    .timestamp(new Date(sensorData.timestamp))
    .floatField('temperature', sensorData.temperature)
    .floatField('pressure', sensorData.pressure)
    .floatField('humidity', sensorData.humidity)
    .intField('gasResistance', sensorData.gasResistance)
    .intField('iaqPercent', sensorData.iaqPercent)
    .intField('iaqScore', sensorData.iaqScore)
    .intField('eCO2Value', sensorData.eCO2Value);
  writeApi.writePoint(point);
  await writeApi.flush();
};

app.prepare().then(() => {
  const server = express();

  server.use(bodyParser.json()); // For parsing application/json

  // Custom API routes
  server.get('/api/hello', (req: Request, res: Response) => {
    res.json({ message: 'Hello from Express!' });
  });

  server.post('/api/sensorData', async (req: Request, res: Response) => {
    try {
      const sensorData: SensorData = req.body;
      console.log('Received sensor data:', sensorData);

      // Write to InfluxDB
      await writeSensorData(sensorData);

      res.status(200).send('Sensor data received and stored.');
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error processing sensor data.');
    }
  });

  // Default handler for all other routes
  server.all('*', (req: Request, res: Response) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, (err?:Error) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});