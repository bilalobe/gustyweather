import express, { Request, Response, Router } from 'express';
import axios from 'axios';
import { KitronikService } from '../services/kitronik.service';

const router = express.Router();
const kitronikService = new KitronikService();

router.get('/weather', async (req: Request, res: Response) => {
    try {
        const { q } = req.query;
        
        // First get local sensor data
        const localConditions = await kitronikService.getEnvironmentalData();
        
        if (!q) {
            // If no location specified, return local data only
            return res.json({
                source: 'local',
                weather: {
                    temperature: localConditions.temperature,
                    humidity: localConditions.humidity,
                    pressure: localConditions.pressure,
                    airQuality: localConditions.airQualityIndex
                }
            });
        }

        // Get external weather data
        const response = await axios.get(process.env.WEATHER_API_URL!, {
            params: {
                q,
                appid: process.env.WEATHER_API_KEY,
                units: 'metric',
            },
        });

        // Combine external and local data
        return res.json({
            source: 'combined',
            external: response.data,
            local: {
                temperature: localConditions.temperature,
                humidity: localConditions.humidity,
                pressure: localConditions.pressure,
                airQuality: localConditions.airQualityIndex
            }
        });
    } catch (error: any) {
        console.error("Error fetching weather:", error.message);
        return res.status(500).json({ error: error.message || 'Error fetching weather data.' });
    }
});

export default router;