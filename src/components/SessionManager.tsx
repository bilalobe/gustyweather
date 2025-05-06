import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  Close as CloseIcon,
  Timer as TimerIcon,
  DeviceHub as DeviceIcon
} from '@mui/icons-material';
import { useAuthContext } from '../context/AuthContext';

interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastActivity: number;
  expiresAt: number;
}

export const SessionManager: React.FC = () => {
  const { user } = useAuthContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [confirmEndDialog, setConfirmEndDialog] = useState(false);

  const fetchSessions = async () => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/sessions/active', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data.sessions);
      setError(null);
    } catch (error) {
      setError('Failed to load active sessions');
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
      const interval = setInterval(fetchSessions, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleEndSession = async (session: Session) => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionToken: session.id })
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      await fetchSessions();
      setError(null);
    } catch (error) {
      setError('Failed to end session');
      console.error('Error ending session:', error);
    } finally {
      setConfirmEndDialog(false);
      setSelectedSession(null);
    }
  };

  const handleEndAllDeviceSessions = async (deviceId: string) => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/sessions/device/${deviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to end device sessions');
      }

      await fetchSessions();
      setError(null);
    } catch (error) {
      setError('Failed to end device sessions');
      console.error('Error ending device sessions:', error);
    }
  };

  const formatTimeLeft = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m left`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Active Sessions
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {sessions.length === 0 ? (
          <Typography color="text.secondary" align="center">
            No active sessions
          </Typography>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem
                key={session.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="end session"
                    onClick={() => {
                      setSelectedSession(session);
                      setConfirmEndDialog(true);
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DeviceIcon fontSize="small" />
                      {session.deviceName}
                      <Chip
                        size="small"
                        label={formatTimeLeft(session.expiresAt)}
                        icon={<TimerIcon />}
                        color={
                          session.expiresAt - Date.now() < 300000 // 5 minutes
                            ? 'warning'
                            : 'default'
                        }
                      />
                    </Box>
                  }
                  secondary={`Last activity: ${new Date(session.lastActivity).toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Dialog
          open={confirmEndDialog}
          onClose={() => {
            setConfirmEndDialog(false);
            setSelectedSession(null);
          }}
        >
          <DialogTitle>End Session</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to end this session for device "{selectedSession?.deviceName}"?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmEndDialog(false);
                setSelectedSession(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => selectedSession && handleEndSession(selectedSession)}
            >
              End Session
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};