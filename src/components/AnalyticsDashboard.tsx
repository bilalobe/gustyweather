import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid2,
  Tab,
  Tabs,
  CircularProgress,
  useTheme
} from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  airQuality: number;
}

interface AnalyticsDashboardProps {
  data: AnalyticsData[];
  loading?: boolean;
  startDate?: Date;
  endDate?: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  data,
  loading = false,
  startDate,
  endDate
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const calculateStats = () => {
    if (!data.length) return null;

    const stats = {
      temperature: {
        avg: 0,
        min: Infinity,
        max: -Infinity
      },
      humidity: {
        avg: 0,
        min: Infinity,
        max: -Infinity
      },
      airQuality: {
        avg: 0,
        min: Infinity,
        max: -Infinity
      }
    };

    data.forEach(reading => {
      // Temperature
      stats.temperature.avg += reading.temperature;
      stats.temperature.min = Math.min(stats.temperature.min, reading.temperature);
      stats.temperature.max = Math.max(stats.temperature.max, reading.temperature);

      // Humidity
      stats.humidity.avg += reading.humidity;
      stats.humidity.min = Math.min(stats.humidity.min, reading.humidity);
      stats.humidity.max = Math.max(stats.humidity.max, reading.humidity);

      // Air Quality
      stats.airQuality.avg += reading.airQuality;
      stats.airQuality.min = Math.min(stats.airQuality.min, reading.airQuality);
      stats.airQuality.max = Math.max(stats.airQuality.max, reading.airQuality);
    });

    // Calculate averages
    const count = data.length;
    stats.temperature.avg /= count;
    stats.humidity.avg /= count;
    stats.airQuality.avg /= count;

    return stats;
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: theme.palette.divider
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  const trendData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: data.map(d => d.temperature),
        borderColor: theme.palette.error.main,
        backgroundColor: theme.palette.error.main + '20',
        fill: true
      },
      {
        label: 'Humidity (%)',
        data: data.map(d => d.humidity),
        borderColor: theme.palette.info.main,
        backgroundColor: theme.palette.info.main + '20',
        fill: true
      },
      {
        label: 'Air Quality',
        data: data.map(d => d.airQuality),
        borderColor: theme.palette.success.main,
        backgroundColor: theme.palette.success.main + '20',
        fill: true
      }
    ]
  };

  const stats = calculateStats();

  const StatCard: React.FC<{ title: string; value: string; subValue?: string }> = ({
    title,
    value,
    subValue
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          {value}
        </Typography>
        {subValue && (
          <Typography variant="body2" color="textSecondary">
            {subValue}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={activeTab} onChange={handleTabChange} aria-label="analytics tabs">
        <Tab label="Overview" />
        <Tab label="Trends" />
        <Tab label="Statistics" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        <Grid2 container spacing={3}>
          {stats && (
            <>
              <Grid2 item xs={12} md={4}>
                <StatCard
                  title="Temperature"
                  value={`${stats.temperature.avg.toFixed(1)}°C`}
                  subValue={`Range: ${stats.temperature.min.toFixed(1)} - ${stats.temperature.max.toFixed(1)}°C`}
                />
              </Grid2>
              <Grid2 item xs={12} md={4}>
                <StatCard
                  title="Humidity"
                  value={`${stats.humidity.avg.toFixed(1)}%`}
                  subValue={`Range: ${stats.humidity.min.toFixed(1)} - ${stats.humidity.max.toFixed(1)}%`}
                />
              </Grid2>
              <Grid2 item xs={12} md={4}>
                <StatCard
                  title="Air Quality"
                  value={`${stats.airQuality.avg.toFixed(0)}`}
                  subValue={`Range: ${stats.airQuality.min.toFixed(0)} - ${stats.airQuality.max.toFixed(0)}`}
                />
              </Grid2>
            </>
          )}
          <Grid2 item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Trends
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Line options={chartOptions} data={trendData} />
                </Box>
              </CardContent>
            </Card>
          </Grid2>
        </Grid2>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Environmental Trends
            </Typography>
            <Box sx={{ height: 400 }}>
              <Line options={chartOptions} data={trendData} />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Grid2 container spacing={3}>
          {stats && Object.entries(stats).map(([key, stat]) => (
            <Grid2 item xs={12} md={4} key={key}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                    {key}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Average: {stat.avg.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Minimum: {stat.min.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Maximum: {stat.max.toFixed(1)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid2>
          ))}
        </Grid2>
      </TabPanel>
    </Box>
  );
};