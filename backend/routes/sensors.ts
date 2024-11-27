import express from 'express';
import { InfluxDB } from '@influxdata/influxdb-client';

const router = express.Router();

// InfluxDB connection configuration
const influxUrl = process.env.INFLUXDB_URL || '';
const influxToken = process.env.INFLUXDB_TOKEN || '';
const influxOrg = process.env.INFLUXDB_ORG || '';
const queryApi = new InfluxDB({ url: influxUrl, token: influxToken }).getQueryApi(influxOrg);

interface SensorRow {
    _time: string;
    _value: string;
    pressure: string;
    humidity: string;
    gasResistance: string;
    iaqPercent: string;
    iaqScore: string;
    eCO2Value: string;
}

router.get('/sensorData', async (req, res) => {
    try {
        // Construct the flux query for filtering based on specific metrics of interest
        const fluxQuery = `
            from(bucket: "${process.env.INFLUXDB_BUCKET}")
                |> range(start: -15m) // Example time range - last 15 minutes
                |> filter(fn: (r) => r._measurement == "sensor_readings")
        `;

        const rows = await queryApi.collectRows(fluxQuery);

        const sensorData = rows.map(row => {
            const typedRow = row as SensorRow;
            return {
                time: new Date(typedRow._time).getTime(),
                temperature: parseFloat(typedRow._value) || 0,
                pressure: parseFloat(typedRow.pressure) || 0,
                humidity: parseFloat(typedRow.humidity) || 0,
                gasResistance: parseFloat(typedRow.gasResistance) || 0,
                iaqPercent: parseFloat(typedRow.iaqPercent) || 0,
                iaqScore: parseFloat(typedRow.iaqScore) || 0,
                eCO2Value: parseFloat(typedRow.eCO2Value) || 0
            };
        });

        res.json({ sensorData });
    } catch (error) {
        console.error("Error querying sensor data:", error);
        res.status(500).json({ error: 'Error querying sensor data.' });
    }
});

module.exports = router;