import express from 'express';
import { InfluxDB } from '@influxdata/influxdb-client';

const router = express.Router();

// InfluxDB connection configuration
const queryApi = new InfluxDB({ url: process.env.INFLUXDB_URL, token: process.env.INFLUXDB_TOKEN }).getQueryApi(process.env.INFLUXDB_ORG);

router.get('/sensorData', async (req, res) => {
    try {
        // Construct the flux query for filtering based on specific metrics of interest
        const fluxQuery = `
            from(bucket: "${process.env.INFLUXDB_BUCKET}")
                |> range(start: -15m) // Example time range - last 15 minutes
                |> filter(fn: (r) => r._measurement == "sensor_readings")
        `;

        const rows = await queryApi.collectRows(fluxQuery);

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
});

module.exports = router;