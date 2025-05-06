import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { getAuth } from 'firebase/auth';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  handleResetSession = async () => {
    // Clear session and device tokens
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('deviceToken');

    // Sign out user
    const auth = getAuth();
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }

    // Reload the page
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Paper 
          sx={{ 
            p: 3, 
            m: 2, 
            maxWidth: 600, 
            mx: 'auto',
            textAlign: 'center' 
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography color="text.secondary" paragraph>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
            <Button 
              variant="outlined" 
              onClick={this.handleResetSession}
            >
              Reset Session
            </Button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}