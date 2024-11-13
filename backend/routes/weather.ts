import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY; // Store your API key securely (e.g., in a .env file or environment variables)
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'; // Or your preferred provider's URL

router.get('/weather', async (req: Request, res: Response): Promise<express.Response> => {
  try {
    const { q } = req.query; // Location query (city name, zip code, etc.)

    if (!q) {
      return res.status(400).json({ error: 'Location query parameter (q) is required.' });
    }

    const response = await axios.get(WEATHER_API_URL, {
      params: {
        q, // Location query
        appid: WEATHER_API_KEY,
        units: 'metric', // Or 'imperial' for Fahrenheit
      },
    });

    const weatherData = response.data;

    return res.json(weatherData); // Return the weather data from external API
  } catch (error) {
    console.error("Error fetching weather:", error.message, error.response?.data || '');
    return res.status(500).json({ error: error.message || 'Error fetching weather data.' });
  }
});

export default router;