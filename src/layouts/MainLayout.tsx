import React, { useState, useEffect } from 'react';
import { 
  Container, 
  AppBar, 
  Toolbar, 
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Badge,
  Box,
  CircularProgress,
  Button
} from '@mui/material';
import { useRouter } from 'next/router';
import MenuIcon from '@mui/icons-material/Menu';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import SettingsIcon from '@mui/icons-material/Settings';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuthContext } from '../context/AuthContext';
import { getAuth, signOut } from 'firebase/auth';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

interface AlertState {
  count: number;
  alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  requireAuth = true 
}) => {
  const { user, loading, error } = useAuthContext();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertState>({ count: 0, alerts: [] });
  const [sensorStatus, setSensorStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    // Poll sensor status
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/sensors/status');
        const data = await response.json();
        setSensorStatus(data.isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        setSensorStatus('error');
      }
    };

    const statusInterval = setInterval(pollStatus, 30000);
    pollStatus();

    return () => clearInterval(statusInterval);
  }, []);

  const navigationItems = [
    { text: 'Dashboard', icon: <ThermostatIcon />, path: '/' },
    { text: 'Analytics', icon: <TimelineIcon />, path: '/analytics' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const handleNavigation = (path: string) => {
    router.push(path);
    setDrawerOpen(false);
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (requireAuth && !user) {
    router.push('/login');
    return null;
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" onClick={() => router.push('/login')}>
          Return to Login
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" className={styles.appBar}>
        <Toolbar className={styles.toolbar}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" className={styles.title} sx={{ flexGrow: 1 }}>
            GustyWeather
          </Typography>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">
                {user.email}
              </Typography>
              <Button color="inherit" onClick={handleSignOut}>
                Sign Out
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title={`Sensor Status: ${sensorStatus}`}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: sensorStatus === 'connected' ? 'success.main' : 
                          sensorStatus === 'error' ? 'error.main' : 'warning.main'
                }}
              />
            </Tooltip>

            <Tooltip title="Alerts">
              <IconButton color="inherit">
                <Badge badgeContent={alerts.count} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <List sx={{ width: 250 }}>
          {navigationItems.map((item) => (
            <ListItem 
              button 
              key={item.text}
              onClick={() => handleNavigation(item.path)}
              selected={router.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container className={styles.mainContainer}>
          {children}
        </Container>
      </Box>

      <Box component="footer" sx={{ p: 3, bgcolor: 'background.default' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          {'Copyright © '}
          GustyWeather {new Date().getFullYear()}
          {'. '}
          <Typography component="span" color="primary">
            {sensorStatus === 'connected' ? 'Sensor Active' : 'Sensor Inactive'}
          </Typography>
        </Typography>
      </Box>
    </Box>
  );
};