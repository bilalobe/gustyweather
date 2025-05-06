import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { Box, Typography, TextField, Alert } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuthContext } from '../context/AuthContext';

interface AnalyticsData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  airQuality: number;
}

const AnalyticsPage = () => {
  const { user } = useAuthContext();
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate.toISOString());
      if (endDate) params.append('end', endDate.toISOString());

      const response = await fetch(`/api/sensors/readings/history?${params}`, {
        headers: {
          Authorization: `Bearer ${await user?.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const result = await response.json();
      setData(result.sensorData);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [startDate, endDate, user]);

  return (
    <MainLayout>
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Typography variant="h4" component="h1">
              Environmental Analytics
            </Typography>
            
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  renderInput={(params) => <TextField {...params} size="small" />}
                  maxDate={endDate || undefined}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  renderInput={(params) => <TextField {...params} size="small" />}
                  minDate={startDate || undefined}
                />
              </Box>
            </LocalizationProvider>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <AnalyticsDashboard 
            data={data}
            loading={loading}
            startDate={startDate || undefined}
            endDate={endDate || undefined}
          />
        </Box>
      </ProtectedRoute>
    </MainLayout>
  );
};

export default AnalyticsPage;