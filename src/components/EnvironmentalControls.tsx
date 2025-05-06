import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Slider,
  CircularProgress,
  Tooltip,
  Fade
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  Fan,
  LightbulbOutline,
  DisplaySettings,
  PanTool,
  WbSunny,
  AcUnit
} from '@mui/icons-material';
import { KitronikOutputs } from '../services/kitronik.service';
import { OutputStatus } from '../../backend/types/sensor';

interface EnvironmentalControlsProps {
  temperature: number;
  humidity: number;
  airQuality: number;
  outputStatus: OutputStatus;
  onStatusChange: (newStatus: OutputStatus) => void;
}

interface OutputControl {
  label: string;
  icon: JSX.Element;
  status: boolean;
  onToggle: () => Promise<void>;
  description: string;
}

export const EnvironmentalControls: React.FC<EnvironmentalControlsProps> = ({
  temperature,
  humidity,
  airQuality,
  outputStatus,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);

  const withLoadingState = async (key: string, operation: () => Promise<void>) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await operation();
      const newStatus = await KitronikOutputs.getOutputStatus();
      onStatusChange(newStatus);
    } catch (error) {
      console.error(`Error in ${key}:`, error);
      setError(`Failed to control ${key}`);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDisplayToggle = async () => {
    if (!outputStatus.displayActive) {
      await KitronikOutputs.updateDisplay([{
        text: [
          'Environmental Status:',
          `Temp: ${temperature.toFixed(1)}°C`,
          `Humidity: ${humidity.toFixed(1)}%`,
          `Air Quality: ${airQuality}`
        ]
      }]);
    } else {
      // Clear display
      await KitronikOutputs.updateDisplay([{ text: [] }]);
    }
  };

  const handleLEDToggle = async () => {
    if (!outputStatus.ledsActive) {
      const pattern = [
        {
          index: 0,
          r: temperature > 25 ? 255 : 0,
          g: temperature < 15 ? 255 : 0,
          b: 0
        },
        {
          index: 1,
          r: humidity > 70 ? 255 : 0,
          g: humidity < 30 ? 255 : 0,
          b: 0
        },
        {
          index: 2,
          r: airQuality < 60 ? 255 : 0,
          g: airQuality > 80 ? 255 : 0,
          b: 0
        }
      ];
      await KitronikOutputs.setLEDPattern(pattern);
    } else {
      await KitronikOutputs.setLEDPattern([]);
    }
  };

  const handleVentilationToggle = async (index: number) => {
    await KitronikOutputs.setHighPowerOutput(
      index,
      !outputStatus.highPowerState[index]
    );
  };

  const handleServoChange = async (index: number, angle: number) => {
    await KitronikOutputs.setServoPosition(index, angle);
  };

  const handleAutoMode = async () => {
    // Enable automatic control based on environmental conditions
    await withLoadingState('auto', async () => {
      // Set ventilation based on air quality
      if (airQuality < 60) {
        await KitronikOutputs.setHighPowerOutput(0, true);
      }

      // Set display to show current conditions
      await handleDisplayToggle();

      // Update LED indicators
      await handleLEDToggle();

      // Set servo positions based on conditions
      const humidityAngle = Math.round((humidity / 100) * 180);
      await handleServoChange(0, humidityAngle);
    });
  };

  const outputControls: OutputControl[] = [
    {
      label: 'Display',
      icon: <DisplaySettings />,
      status: outputStatus.displayActive,
      onToggle: () => withLoadingState('display', handleDisplayToggle),
      description: 'Show environmental data on OLED display'
    },
    {
      label: 'Status LEDs',
      icon: <LightbulbOutline />,
      status: outputStatus.ledsActive,
      onToggle: () => withLoadingState('leds', handleLEDToggle),
      description: 'Indicate conditions with LED colors'
    },
    {
      label: 'Ventilation',
      icon: <Fan />,
      status: outputStatus.highPowerState[0],
      onToggle: () => withLoadingState('ventilation', () => handleVentilationToggle(0)),
      description: 'Control air circulation fan'
    },
    {
      label: 'Auto Mode',
      icon: airQuality > 80 ? <WbSunny /> : <AcUnit />,
      status: outputStatus.highPowerState.some(state => state),
      onToggle: handleAutoMode,
      description: 'Automatically manage environmental controls'
    }
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Environmental Controls
        </Typography>

        {outputControls.map((control, index) => (
          <Fade in key={index}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              p: 1,
              borderRadius: 1,
              bgcolor: control.status ? 'action.selected' : 'transparent',
              transition: 'background-color 0.3s'
            }}>
              <Tooltip title={control.description}>
                <IconButton 
                  color={control.status ? 'primary' : 'default'}
                  disabled={loading[control.label.toLowerCase()]}
                >
                  {control.icon}
                </IconButton>
              </Tooltip>
              <Typography sx={{ ml: 1, flex: 1 }}>{control.label}</Typography>
              <LoadingButton
                loading={loading[control.label.toLowerCase()]}
                onClick={control.onToggle}
                variant={control.status ? 'contained' : 'outlined'}
                size="small"
              >
                {control.status ? 'Active' : 'Inactive'}
              </LoadingButton>
            </Box>
          </Fade>
        ))}

        {/* Servo Controls */}
        {outputStatus.servoPositions.map((position, index) => (
          <Fade in key={`servo-${index}`}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              p: 1,
              borderRadius: 1
            }}>
              <Tooltip title="Adjust ventilation angle">
                <IconButton>
                  <PanTool />
                </IconButton>
              </Tooltip>
              <Box sx={{ ml: 1, flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Servo {index + 1}
                </Typography>
                <Slider
                  value={position}
                  min={0}
                  max={180}
                  onChange={(_, value) => {
                    if (!loading[`servo-${index}`]) {
                      withLoadingState(`servo-${index}`, () => 
                        handleServoChange(index, value as number)
                      );
                    }
                  }}
                  disabled={loading[`servo-${index}`]}
                  sx={{ mt: 1 }}
                  marks={[
                    { value: 0, label: '0°' },
                    { value: 90, label: '90°' },
                    { value: 180, label: '180°' }
                  ]}
                />
              </Box>
              <Typography sx={{ ml: 2, minWidth: 40 }}>
                {position}°
              </Typography>
              {loading[`servo-${index}`] && (
                <CircularProgress size={16} sx={{ ml: 1 }} />
              )}
            </Box>
          </Fade>
        ))}

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};