import * as React from 'react';
import { Container, AppBar, Toolbar, Typography } from '@mui/material';
import styles from './MainLayout.module.css'; // Import CSS Modules

interface MainLayoutProps {
    children: React.ReactNode;
  }

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => { // Use React.FC for functional components
  return (
      <div>
        <AppBar position="static" className={styles.appBar}>
            <Toolbar className={styles.toolbar}>
              <Typography variant="h6" component="div" className={styles.title} sx={{ flexGrow: 1 }}>
                GustyWeather
              </Typography> {/* Example Header */}
            </Toolbar>
        </AppBar>
          <Container className={styles.mainContainer}>
            {children}
          </Container>

      </div>
  );
};


export default MainLayout;