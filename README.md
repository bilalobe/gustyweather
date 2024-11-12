# GustyWeather App ☀️

This repository contains the code for my personalized weather application, built with a focus on accurate data, user customization, and insightful visualizations.  The app fetches real-time weather information from external APIs and integrates seamlessly with a Raspberry Pi (and sensor HAT) for advanced, hyperlocal metrics.

## Features ✨

* **Real-time Weather:** Displays current conditions (temperature, humidity, wind, etc.) for any location.
* **Forecasting:** Provides hourly and daily forecasts with detailed weather information.
* **Advanced Metrics:** Integrates with a Raspberry Pi and sensor HAT (Kitronik Air Quality Control) _now featuring a tailored npm pkg_ to display custom environmental metrics, historical data trends, and interactive charts powered by InfluxDB, Prometheus, and Grafana.
* **User Customization:** Allows users to set preferred units, save favorite locations, and manage notification preferences (with future plans for severe weather alerts).
* **Secure Authentication:**  Uses Firebase Authentication to protect user data and personalize the experience. 
* **Modern UI:** Built with React, Next.js, and Material UI for a responsive and user-friendly interface.

## Tech Stack 💻

* **Front-end:** React, Next.js, Material UI
* **Back-end:** Express.js, Firebase Cloud Functions (Serverless)
* **Database:** InfluxDB + Telegraf (time-series data), Firebase (user data, preferences)
* **Metrics & Visualization:** Prometheus, Grafana
* **Weather API:** OpenWeatherMap, AccuWeather
* **Hosting:** Vercel

## Getting Started 🚀

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/bilalobegustyweather.git
   cd gustyweather
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables:**
   - Create a `.env.local` file in the root directory and add the necessary API keys and configuration variables (e.g., weather API key, Firebase config, InfluxDB credentials).

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

5. **Raspberry Pi Setup (for Advanced Metrics):**
   - Follow the instructions in the [Raspberry Pi Setup Guide](./docs/raspberry-pi-setup.md) to configure your Raspberry Pi, install the necessary libraries for your sensor HAT, and connect it to InfluxDB and Prometheus.

## Makefile 

```makefile
dev:
	npm run dev

build:
	npm run build

deploy:
	vercel deploy --prod  # Or your chosen deployment command
```

## Contributing 🤝

Contributions are welcome! Please feel free to open issues or submit pull requests.


## License 📜

MIT License
