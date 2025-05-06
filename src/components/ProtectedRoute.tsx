import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthContext } from '../context/AuthContext';
import { CircularProgress, Box, Typography, Button } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, error } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 2, 
        mt: 4 
      }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" onClick={() => router.push('/login')}>
          Return to Login
        </Button>
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  if (requireAdmin && !user.claims?.admin) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 2, 
        mt: 4 
      }}>
        <Typography color="error">
          Admin access required
        </Typography>
        <Button variant="contained" onClick={() => router.back()}>
          Go Back
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
}