import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Development mode flag - check if we're in development and Supabase is blocked
const isDevelopmentMode = import.meta.env.MODE === 'development';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for development mode
const createMockUser = (email: string): User => ({
  id: 'mock-user-id',
  email,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  confirmation_sent_at: new Date().toISOString(),
} as User);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (isDevelopmentMode) {
        // In development mode, try Supabase first but fall back to mock if it fails
        try {
          // Set up auth state listener FIRST
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
              setSession(session);
              setUser(session?.user ?? null);
              setLoading(false);
              setIsSupabaseAvailable(true);
            }
          );

          // THEN check for existing session with error handling
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          setIsSupabaseAvailable(true);

          return () => subscription.unsubscribe();
        } catch (error) {
          console.warn('Supabase unavailable in development, using mock auth:', error);
          setIsSupabaseAvailable(false);
          
          // Check localStorage for mock session
          const mockSession = localStorage.getItem('mock-auth-session');
          if (mockSession) {
            try {
              const parsedSession = JSON.parse(mockSession);
              setUser(parsedSession.user);
              setSession(parsedSession);
            } catch (parseError) {
              console.warn('Failed to parse mock session:', parseError);
            }
          }
          setLoading(false);
        }
      } else {
        // Production mode - use Supabase normally
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        );

        supabase.auth.getSession()
          .then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          })
          .catch((error) => {
            console.error('Failed to get initial session:', error);
            setLoading(false);
          });

        return () => subscription.unsubscribe();
      }
    };

    initializeAuth();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseAvailable && isDevelopmentMode) {
      // Mock signup in development mode when Supabase is not available
      const mockUser = createMockUser(email);
      const mockSession = {
        user: mockUser,
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
      } as any;
      
      localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
      setUser(mockUser);
      setSession(mockSession);
      
      return { error: null };
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      return { error };
    } catch (networkError) {
      // If in development mode and network fails, fall back to mock
      if (isDevelopmentMode) {
        console.warn('Supabase signup failed, using mock auth:', networkError);
        setIsSupabaseAvailable(false);
        
        const mockUser = createMockUser(email);
        const mockSession = {
          user: mockUser,
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
        } as any;
        
        localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
        setUser(mockUser);
        setSession(mockSession);
        
        return { error: null };
      }
      
      // Handle network errors or blocked requests
      const errorMessage = networkError instanceof Error 
        ? networkError.message 
        : 'Network error occurred';
      
      return { 
        error: { 
          message: `Connection failed: ${errorMessage}. Please check your internet connection or try again later.`
        }
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseAvailable && isDevelopmentMode) {
      // Mock signin in development mode when Supabase is not available
      const mockUser = createMockUser(email);
      const mockSession = {
        user: mockUser,
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
      } as any;
      
      localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
      setUser(mockUser);
      setSession(mockSession);
      
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (networkError) {
      // If in development mode and network fails, fall back to mock
      if (isDevelopmentMode) {
        console.warn('Supabase signin failed, using mock auth:', networkError);
        setIsSupabaseAvailable(false);
        
        const mockUser = createMockUser(email);
        const mockSession = {
          user: mockUser,
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
        } as any;
        
        localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
        setUser(mockUser);
        setSession(mockSession);
        
        return { error: null };
      }
      
      // Handle network errors or blocked requests
      const errorMessage = networkError instanceof Error 
        ? networkError.message 
        : 'Network error occurred';
      
      return { 
        error: { 
          message: `Connection failed: ${errorMessage}. Please check your internet connection or try again later.`
        }
      };
    }
  };

  const signInWithProvider = async (provider: 'google' | 'github') => {
    if (!isSupabaseAvailable && isDevelopmentMode) {
      // Mock OAuth signin in development mode when Supabase is not available
      const mockUser = createMockUser(`${provider}.user@example.com`);
      const mockSession = {
        user: mockUser,
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
      } as any;
      
      localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
      setUser(mockUser);
      setSession(mockSession);
      
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      return { error };
    } catch (networkError) {
      // If in development mode and network fails, fall back to mock
      if (isDevelopmentMode) {
        console.warn('Supabase OAuth failed, using mock auth:', networkError);
        setIsSupabaseAvailable(false);
        
        const mockUser = createMockUser(`${provider}.user@example.com`);
        const mockSession = {
          user: mockUser,
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
        } as any;
        
        localStorage.setItem('mock-auth-session', JSON.stringify(mockSession));
        setUser(mockUser);
        setSession(mockSession);
        
        return { error: null };
      }
      
      // Handle network errors or blocked requests
      const errorMessage = networkError instanceof Error 
        ? networkError.message 
        : 'Network error occurred';
      
      return { 
        error: { 
          message: `Connection failed: ${errorMessage}. Please check your internet connection or try again later.`
        }
      };
    }
  };

  const signOut = async () => {
    if (!isSupabaseAvailable && isDevelopmentMode) {
      // Mock signout in development mode
      localStorage.removeItem('mock-auth-session');
      setUser(null);
      setSession(null);
      return { error: null };
    }

    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}