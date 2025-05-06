import React from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SessionManager } from '../components/SessionManager';
import { SettingsPanel } from '../components/SettingsPanel';
import { Box, Grid2, Typography, Divider } from '@mui/material';
import { useAuthContext } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuthContext();

  const handleThresholdsChange = async (thresholds: any) => {
    // Implementation will be added in the next iteration
  };

  const handleCalibrate = async () => {
    // Implementation will be added in the next iteration
  };

  return (
    <MainLayout>
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Settings
          </Typography>

          <Grid2 container spacing={3}>
            <Grid2 item xs={12} md={8}>
              <SettingsPanel
                thresholds={{
                  temperature: { min: 15, max: 30 },
                  humidity: { min: 30, max: 70 },
                  airQuality: { poor: 60, hazardous: 30 }
                }}
                onThresholdsChange={handleThresholdsChange}
                onCalibrate={handleCalibrate}
              />
            </Grid2>

            <Grid2 item xs={12} md={4}>
              <SessionManager />
            </Grid2>
          </Grid2>
        </Box>
      </ProtectedRoute>
    </MainLayout>
  );
};

export default SettingsPage;