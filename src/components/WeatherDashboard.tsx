import React, { useEffect, useState } from 'react';
import { Box, Typography, Snackbar, Alert, Button, Tooltip, Grid2 } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { StatusIndicators } from './StatusIndicators';
import { EnvironmentalControls } from './EnvironmentalControls';
import { DataVisualization } from './DataVisualization';
import { KitronikOutputs } from '../services/kitronik.service';
import { OutputStatus } from '../../backend/types/sensor';
import { useAuthContext } from '../context/AuthContext';

interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
  airQualityIndex: number;
  timestamp: string;
}

const WeatherDashboard: React.FC = () => {
  const { user } = useAuthContext();
  const [currentData, setCurrentData] = useState<SensorData | null>(null);
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [outputStatus, setOutputStatus] = useState<OutputStatus>({
    displayActive: false,
    ledsActive: false,
    highPowerState: [false, false, false, false],
    servoPositions: [0, 0],
    lastUpdate: ''
  });

  const fetchCurrentData = async () => {
    try {
      const response = await fetch('/api/sensors/readings/current', {
        headers: {
          Authorization: `Bearer ${await user?.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch current sensor data');
      }
      
      const data = await response.json();
      setCurrentData(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch current sensor data');
      console.error(err);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('/api/sensors/readings/history', {
        headers: {
          Authorization: `Bearer ${await user?.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }
      
      const data = await response.json();
      setHistoricalData(data.sensorData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch historical data');
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchCurrentData(), fetchHistoricalData()]);
        setLoading(false);
      };

      fetchData();

      if (autoRefresh) {
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [autoRefresh, user]);

  useEffect(() => {
    const fetchOutputStatus = async () => {
      try {
        const status = await KitronikOutputs.getOutputStatus();
        setOutputStatus(status);
      } catch (error) {
        console.error('Failed to fetch output status:', error);
      }
    };

    fetchOutputStatus();
    const interval = setInterval(fetchOutputStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    fetchCurrentData();
    fetchHistoricalData();
  };

  const handleOutputStatusChange = (newStatus: OutputStatus) => {
    setOutputStatus(newStatus);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Weather Station Dashboard
        </Typography>
        <Box></Box>
          <Tooltip title="Toggle auto-refresh">
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              sx={{ mr: 1 }}
            >
              Auto Refresh
            </Button>
          </Tooltip>
          <Tooltip title="Refresh now">
            <Button
              variant="outlined"
              onClick={handleManualRefresh}
              startIcon={<RefreshIcon />}
              disabled={loading}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Environmental Status Indicators */}
      <Box sx={{ mb: 3 }}>
        <StatusIndicators
          temperature={currentData?.temperature ?? 0}
          humidity={currentData?.humidity ?? 0}
          pressure={currentData?.pressure ?? 0}
          airQuality={currentData?.airQualityIndex ?? 0}
          loading={loading}
        />
      </Box>

      <Grid2 container spacing={3}>
        {/* Data Visualization */}
        <Grid2 item xs={12} md={8}>
          <DataVisualization
            data={historicalData}
            loading={loading}
            onRefresh={handleManualRefresh}
          />
        </Grid2>

        {/* Environmental Controls */}
        <Grid2 item xs={12} md={4}>
          <EnvironmentalControls
            temperature={currentData?.temperature ?? 0}
            humidity={currentData?.humidity ?? 0}
            airQuality={currentData?.airQualityIndex ?? 0}
            outputStatus={outputStatus}
            onStatusChange={handleOutputStatusChange}
          />
        </Grid2>
      </Grid2>

      {/* Error Snackbar */}
      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WeatherDashboard;