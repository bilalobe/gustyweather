import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { MonitoringThresholds } from '../../backend/types/sensor';

interface SettingsPanelProps {
  thresholds: MonitoringThresholds;
  onThresholdsChange: (thresholds: MonitoringThresholds) => Promise<void>;
  onCalibrate: () => Promise<void>;
}

interface ExpandableSection {
  title: string;
  key: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  thresholds,
  onThresholdsChange,
  onCalibrate
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['thresholds']));
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [autoCalibration, setAutoCalibration] = useState(false);

  const sections: ExpandableSection[] = [
    { title: 'Environmental Thresholds', key: 'thresholds' },
    { title: 'Calibration Settings', key: 'calibration' },
    { title: 'Display Settings', key: 'display' }
  ];

  const handleExpandToggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveThresholds = async () => {
    setLoading(true);
    try {
      await onThresholdsChange(localThresholds);
      setSuccess('Thresholds updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update thresholds');
    } finally {
      setLoading(false);
    }
  };

  const handleCalibrate = async () => {
    setLoading(true);
    try {
      await onCalibrate();
      setSuccess('Calibration completed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Calibration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Settings
        </Typography>

        {sections.map(({ title, key }) => (
          <Box key={key} sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                py: 1
              }}
              onClick={() => handleExpandToggle(key)}
            >
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {title}
              </Typography>
              <IconButton size="small">
                {expanded.has(key) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={expanded.has(key)}>
              <Box sx={{ py: 2 }}>
                {key === 'thresholds' && (
                  <>
                    <Box sx={{ mb: 3 }}>
                      <Typography gutterBottom>Temperature Range (°C)</Typography>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={[localThresholds.temperature.min, localThresholds.temperature.max]}
                          onChange={(_, value) => setLocalThresholds(prev => ({
                            ...prev,
                            temperature: {
                              min: Array.isArray(value) ? value[0] : prev.temperature.min,
                              max: Array.isArray(value) ? value[1] : prev.temperature.max
                            }
                          }))}
                          valueLabelDisplay="auto"
                          min={0}
                          max={40}
                          marks={[
                            { value: 15, label: '15°C' },
                            { value: 25, label: '25°C' }
                          ]}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography gutterBottom>Humidity Range (%)</Typography>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={[localThresholds.humidity.min, localThresholds.humidity.max]}
                          onChange={(_, value) => setLocalThresholds(prev => ({
                            ...prev,
                            humidity: {
                              min: Array.isArray(value) ? value[0] : prev.humidity.min,
                              max: Array.isArray(value) ? value[1] : prev.humidity.max
                            }
                          }))}
                          valueLabelDisplay="auto"
                          min={0}
                          max={100}
                          marks={[
                            { value: 30, label: '30%' },
                            { value: 70, label: '70%' }
                          ]}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography gutterBottom>Air Quality Thresholds</Typography>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={[localThresholds.airQuality.hazardous, localThresholds.airQuality.poor]}
                          onChange={(_, value) => setLocalThresholds(prev => ({
                            ...prev,
                            airQuality: {
                              hazardous: Array.isArray(value) ? value[0] : prev.airQuality.hazardous,
                              poor: Array.isArray(value) ? value[1] : prev.airQuality.poor
                            }
                          }))}
                          valueLabelDisplay="auto"
                          min={0}
                          max={100}
                          marks={[
                            { value: 30, label: 'Hazardous' },
                            { value: 60, label: 'Poor' }
                          ]}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <LoadingButton
                        loading={loading}
                        onClick={handleSaveThresholds}
                        startIcon={<SaveIcon />}
                        variant="contained"
                      >
                        Save Thresholds
                      </LoadingButton>
                    </Box>
                  </>
                )}

                {key === 'calibration' && (
                  <>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoCalibration}
                          onChange={(e) => setAutoCalibration(e.target.checked)}
                        />
                      }
                      label="Enable Auto-Calibration"
                    />
                    <Box sx={{ mt: 2 }}>
                      <LoadingButton
                        loading={loading}
                        onClick={handleCalibrate}
                        startIcon={<RefreshIcon />}
                        variant="contained"
                      >
                        Calibrate Now
                      </LoadingButton>
                    </Box>
                  </>
                )}

                {key === 'display' && (
                  <>
                    <TextField
                      fullWidth
                      label="Refresh Interval (seconds)"
                      type="number"
                      defaultValue={30}
                      sx={{ mb: 2 }}
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked />}
                      label="Show Grid2 Lines"
                    />
                  </>
                )}
              </Box>
            </Collapse>
            <Divider />
          </Box>
        ))}

        {(error || success) && (
          <Box sx={{ mt: 2 }}>
            <Collapse in={Boolean(error || success)}>
              <Alert 
                severity={error ? 'error' : 'success'}
                onClose={() => {
                  setError(null);
                  setSuccess(null);
                }}
              >
                {error || success}
              </Alert>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};