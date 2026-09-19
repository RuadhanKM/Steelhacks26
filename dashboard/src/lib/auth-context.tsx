"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  type UserCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setSessionCookie(isAuthenticated: boolean) {
  if (typeof document === "undefined") return;
  if (isAuthenticated) {
    // Session cookie valid for 30 days
    document.cookie =
      "auth_session=true; path=/; max-age=2592000; SameSite=Lax";
  } else {
    // Clear session cookie
    document.cookie =
      "auth_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setSessionCookie(Boolean(currentUser));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<UserCredential> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    setUser(cred.user);
    setSessionCookie(true);
    return cred;
  };

  const logout = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUser(null);
    setSessionCookie(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function formatAuthError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password. Please verify your credentials.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact your administrator.";
      case "auth/too-many-requests":
        return "Access temporarily locked due to repeated failed attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network connection error. Please check your internet connection.";
      case "auth/invalid-api-key":
      case "auth/api-key-not-valid":
        return "Invalid Firebase API key. Please check your environment configuration.";
      default:
        return (error as { message?: string }).message || "Authentication failed. Please try again.";
    }
  }
  return "An unexpected error occurred. Please try again.";
}
