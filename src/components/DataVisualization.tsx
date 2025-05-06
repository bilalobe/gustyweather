import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import TableChartIcon from '@mui/icons-material/TableChart';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { useTheme } from '@mui/material/styles';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface DataPoint {
  temperature: number;
  humidity: number;
  pressure: number;
  airQualityIndex: number;
  timestamp: string;
}

interface DataVisualizationProps {
  data: DataPoint[];
  loading?: boolean;
  onRefresh?: () => void;
  timeRange?: '1h' | '24h' | '7d';
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({
  data,
  loading = false,
  onRefresh,
  timeRange = '1h'
}) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = React.useState<'chart' | 'table'>('chart');

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 15
        }
      },
      y: {
        beginAtZero: false,
        grid: {
          color: theme.palette.divider
        }
      }
    }
  };

  const chartData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: data.map(d => d.temperature),
        borderColor: theme.palette.error.main,
        backgroundColor: theme.palette.error.main + '20',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Humidity (%)',
        data: data.map(d => d.humidity),
        borderColor: theme.palette.info.main,
        backgroundColor: theme.palette.info.main + '20',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Air Quality',
        data: data.map(d => d.airQualityIndex),
        borderColor: theme.palette.success.main,
        backgroundColor: theme.palette.success.main + '20',
        fill: true,
        tension: 0.4
      }
    ]
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}>
          <Typography variant="h6">
            Environmental Trends
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="chart">
                <Tooltip title="Chart View">
                  <TimelineIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="table">
                <Tooltip title="Table View">
                  <TableChartIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <LoadingButton
              loading={loading}
              onClick={onRefresh}
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
            >
              Refresh
            </LoadingButton>
          </Box>
        </Box>

        <Box sx={{ 
          height: { xs: 300, md: 400 },
          position: 'relative'
        }}>
          {loading ? (
            <Box sx={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}>
              <CircularProgress />
            </Box>
          ) : viewMode === 'chart' ? (
            <Line options={chartOptions} data={chartData} />
          ) : (
            <Box sx={{ 
              maxHeight: '400px', 
              overflow: 'auto',
              '& table': {
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  padding: 1,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  textAlign: 'left'
                }
              }
            }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Temperature</th>
                    <th>Humidity</th>
                    <th>Air Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point, index) => (
                    <tr key={index}>
                      <td>{new Date(point.timestamp).toLocaleTimeString()}</td>
                      <td>{point.temperature.toFixed(1)}°C</td>
                      <td>{point.humidity.toFixed(1)}%</td>
                      <td>{point.airQualityIndex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};