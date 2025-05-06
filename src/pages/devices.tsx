import React, { useState, useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  IconButton,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { KitronikOutputs } from '../services/kitronik.service';
import { useAuthContext } from '../context/AuthContext';

interface Device {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'disabled';
  lastActive: string;
}

const DevicesPage = () => {
  const { user } = useAuthContext();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);

  const fetchDevices = async () => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/devices', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }
      
      const data = await response.json();
      setDevices(data.devices);
      setError(null);
    } catch (error) {
      setError('Failed to load devices');
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDevices();
    }
  }, [user]);

  const handleRegisterDevice = async () => {
    setRegistering(true);
    try {
      await KitronikOutputs.registerDevice(newDeviceName);
      setOpenDialog(false);
      setNewDeviceName('');
      await fetchDevices();
      setError(null);
    } catch (error) {
      setError('Failed to register device');
      console.error('Error registering device:', error);
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete device');
      }
      
      await fetchDevices();
      setError(null);
    } catch (error) {
      setError('Failed to delete device');
      console.error('Error deleting device:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'disabled': return 'error';
      default: return 'default';
    }
  };

  return (
    <MainLayout>
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 3 
          }}>
            <Typography variant="h4" component="h1">
              Device Management
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Register New Device
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Card>
            <CardContent>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : devices.length === 0 ? (
                <Typography color="text.secondary" align="center">
                  No devices registered yet
                </Typography>
              ) : (
                <List>
                  {devices.map((device) => (
                    <ListItem
                      key={device.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteDevice(device.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={device.name}
                        secondary={`Last active: ${new Date(device.lastActive).toLocaleString()}`}
                      />
                      <Chip
                        label={device.status}
                        color={getStatusColor(device.status)}
                        size="small"
                        sx={{ mr: 2 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
            <DialogTitle>Register New Device</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Device Name"
                fullWidth
                variant="outlined"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRegisterDevice}
                disabled={!newDeviceName || registering}
                variant="contained"
              >
                {registering ? <CircularProgress size={24} /> : 'Register'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </ProtectedRoute>
    </MainLayout>
  );
};

export default DevicesPage;