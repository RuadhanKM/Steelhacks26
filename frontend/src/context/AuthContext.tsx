import {
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    onIdTokenChanged,
    signInWithEmailAndPassword,
    type User,
} from '@/config/firebase-auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { firebaseAuth, isFirebaseConfigured } from '@/config/firebase';
import { setLatestIdToken } from '@/services/apiClient';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

interface AuthProviderProps {
  readonly children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAuthErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.';
    default:
      return 'Unable to authenticate right now. Please try again.';
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      setError('Firebase authentication is not configured. Add the EXPO_PUBLIC_FIREBASE_* environment variables.');
      return;
    }

    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    const unsubscribeToken = onIdTokenChanged(firebaseAuth, async (nextUser) => {
      if (nextUser) {
        try {
          const token = await Promise.race([
            nextUser.getIdToken(false),
            new Promise<string | null>((res) => setTimeout(() => res(null), 2000)),
          ]);
          if (token) {
            setLatestIdToken(token);
            return;
          }
        } catch {
          // ignore error
        }
        const fallback = (nextUser as any)?.stsTokenManager?.accessToken;
        if (fallback) setLatestIdToken(fallback);
      } else {
        setLatestIdToken(null);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signIn: async (email, password) => {
        if (!firebaseAuth) throw new Error('Firebase authentication is not configured.');
        setError(null);
        try {
          const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
          const token = (cred.user as any)?.stsTokenManager?.accessToken;
          if (token) setLatestIdToken(token);
        } catch (authError) {
          const message = getAuthErrorMessage(authError);
          setError(message);
          throw new Error(message);
        }
      },
      signUp: async (email, password) => {
        if (!firebaseAuth) throw new Error('Firebase authentication is not configured.');
        setError(null);
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
          const token = (cred.user as any)?.stsTokenManager?.accessToken;
          if (token) setLatestIdToken(token);
        } catch (authError) {
          const message = getAuthErrorMessage(authError);
          setError(message);
          throw new Error(message);
        }
      },
      signOut: async () => {
        setLatestIdToken(null);
        if (firebaseAuth) await firebaseSignOut(firebaseAuth);
      },
      clearError: () => setError(null),
    }),
    [error, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
