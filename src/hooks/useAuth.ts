import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/router';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(requireAuth: boolean = true) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAuthState(state => ({ ...state, user, loading: false }));
        
        if (requireAuth && !user) {
          router.push('/login');
        }
      },
      (error) => {
        setAuthState(state => ({
          ...state,
          error: error.message,
          loading: false
        }));
      }
    );

    return () => unsubscribe();
  }, [requireAuth, router]);

  return authState;
}