import * as React from 'react';
import { Container, AppBar, Toolbar, Typography } from '@mui/material';
import { Box } from '@mui/system'; // Or use @mui/material/Box
import styles from './MainLayout.module.css'; // If still using CSS Modules

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}> {/* Use Box for layout */}
      <AppBar position="static" className={styles.appBar}>
        <Toolbar className={styles.toolbar}>
          <Typography variant="h6" component="div" className={styles.title} sx={{ flexGrow: 1 }}>
            GustyWeather
          </Typography> {/* Example Header */}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}> {/* Use flexGrow for main content */}
        <Container className={styles.mainContainer}> {/* Use Container for content width */}
          {children}
        </Container>
      </Box>

      {/* Example of a footer implemented using MUI Box */}
      <Box component="footer" sx={{ p: 3, bgcolor: 'background.default' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          {'Copyright © '}
          GustyWeather {new Date().getFullYear()}
          {'.'}
        </Typography>
      </Box>
    </Box>
  );
};

export default MainLayout;