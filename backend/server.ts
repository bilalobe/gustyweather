import express, { Request, Response } from 'express';
import next from 'next';
import bodyParser from 'body-parser';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';
import Joi from 'joi';
import sensorRoutes from './routes/sensors';

dotenv.config();
dotenv.config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const influxdbOrg = process.env.INFLUXDB_ORG;
const influxdbBucket = process.env.INFLUXDB_BUCKET;
const influxdbToken = process.env.INFLUXDB_TOKEN;
const influxdbUrl = process.env.INFLUXDB_URL;

if (!influxdbOrg || !influxdbBucket || !influxdbToken || !influxdbUrl) {
  throw new Error('InfluxDB environment variables are not set');
}

const client = new InfluxDB({ url: influxdbUrl, token: influxdbToken });
const writeApi = client.getWriteApi(influxdbOrg, influxdbBucket);

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
  server.get('/api/hello', (_req: Request, res: Response) => {
    res.json({ message: 'Hello from Express!' });
  });

  server.post('/api/sensorData', async (req: Request, res: Response) => {
    try {
      const schema = Joi.object({
        timestamp: Joi.date().iso().required(),
        temperature: Joi.number().required(),
        pressure: Joi.number().required(),
        humidity: Joi.number().required(),
        gasResistance: Joi.number().required(),
        iaqPercent: Joi.number().required(),
        iaqScore: Joi.number().required(),
        eCO2Value: Joi.number().required(),
      });

      const { error, value: sensorData } = schema.validate(req.body, { abortEarly: false });

      if (error) {
        const errorDetails = error.details.map((detail) => detail.message);
        console.error('Validation errors:', errorDetails);

        const errorPoint = new Point('sensor_readings_error')
          .timestamp(new Date().toISOString())
          .stringField('errors', `${errorDetails}`);
        writeApi.writePoint(errorPoint);
        await writeApi.flush();

        res.status(400).json({ error: errorDetails });
        return;
      }

      // Write to InfluxDB
      await writeSensorData(sensorData);

      res.status(200).send('Sensor data received and stored.');
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error processing sensor data.');
    }
  });

  // Mount sensor routes
  server.use('/api', sensorRoutes);

  // Default handler for all other routes
  server.all('*', (req: Request, res: Response) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, (err?: Error) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});