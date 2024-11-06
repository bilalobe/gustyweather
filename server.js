import express from 'express';
import next from 'next';
import bodyParser from 'body-parser';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// InfluxDB setup
const client = new InfluxDB({ url: process.env.INFLUXDB_URL, token: process.env.INFLUXDB_TOKEN });
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;

app.prepare().then(() => {
  const server = express();

  server.use(bodyParser.json()); // For parsing application/json

  // Custom API routes
  server.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from Express!' });
  });

  server.post('/api/sensorData', async (req, res) => {
    try {
      const sensorData = req.body;
      console.log('Received sensor data:', sensorData);

      // Write to InfluxDB
      const writeApi = client.getWriteApi(org, bucket);
      const point = new Point('sensor_readings')
        .timestamp(new Date(sensorData.timestamp)) // Assuming your timestamp is ISO8601 format
        .floatField('temperature', sensorData.temperature)
        .floatField('pressure', sensorData.pressure)
        .floatField('humidity', sensorData.humidity)
        .intField('gasResistance', sensorData.gasResistance)
        .intField('iaqPercent', sensorData.iaqPercent)
        .intField('iaqScore', sensorData.iaqScore)
        .intField('eCO2Value', sensorData.eCO2Value);
      writeApi.writePoint(point);
      await writeApi.flush(); // Wait for data to be written

      res.status(200).send('Sensor data received and stored.');
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error processing sensor data.');
    }
  });

  // Default handler for all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});