// src/pages/_app.tsx
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Head from 'next/head';
import MainLayout from '../layouts/MainLayout';  // Import your layout component
import theme from '../themes/theme0';  // Import the theme configuration
import { ReactElement } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function MyApp({ Component, pageProps }: AppProps): ReactElement {
  return (
    <> {/* React Fragment */}
      <Head>
        <title>Gusty Weather</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" /> {/* Important for mobile responsiveness */}
        <meta name="description" content="Gusty Weather App provides real-time weather updates and advanced metrics." /> {/* SEO description */}
        <link rel="manifest" href="/manifest.json" /> {/* For PWA */}
        <link rel="icon" href="/favicon.ico" /> {/* Favicon */}
      </Head>
      <ErrorBoundary>
        <ThemeProvider theme={theme}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          <AuthProvider>
            <MainLayout> {/* Wrap your pages with the layout component */}
              <ErrorBoundary>
                <Component {...pageProps} />
              </ErrorBoundary>
            </MainLayout>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </>
  );
}