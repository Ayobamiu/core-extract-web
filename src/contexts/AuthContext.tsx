"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  loginCount: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = !!user && !!tokens;

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = localStorage.getItem("auth_tokens");
        const storedUser = localStorage.getItem("auth_user");

        if (storedTokens && storedUser) {
          const parsedTokens = JSON.parse(storedTokens);
          const parsedUser = JSON.parse(storedUser);

          // Verify token is still valid
          if (parsedTokens.accessToken) {
            setTokens(parsedTokens);
            setUser(parsedUser);

            // Try to refresh user data
            try {
              await fetchUserData(parsedTokens.accessToken);
            } catch (error) {
              // Token might be expired, try to refresh
              try {
                await refreshTokenFromStorage(parsedTokens.refreshToken);
              } catch (refreshError) {
                // Refresh failed, clear auth state
                clearAuthState();
              }
            }
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Clear authentication state
  const clearAuthState = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem("auth_tokens");
    localStorage.removeItem("auth_user");
  };

  // Fetch user data from API
  const fetchUserData = async (accessToken: string) => {
    const response = await fetch("http://localhost:3000/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user data");
    }

    const data = await response.json();
    if (data.success) {
      setUser(data.data.user);
      localStorage.setItem("auth_user", JSON.stringify(data.data.user));
    }
  };

  // Refresh token from storage
  const refreshTokenFromStorage = async (refreshToken: string) => {
    const response = await fetch("http://localhost:3000/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    if (data.success) {
      const newTokens = {
        ...tokens!,
        accessToken: data.data.accessToken,
        expiresIn: data.data.expiresIn,
      };
      setTokens(newTokens);
      localStorage.setItem("auth_tokens", JSON.stringify(newTokens));
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Login failed");
      }

      const { user: userData, tokens: tokenData } = data.data;

      setUser(userData);
      setTokens(tokenData);
      localStorage.setItem("auth_tokens", JSON.stringify(tokenData));
      localStorage.setItem("auth_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Registration failed");
      }

      const { user: userData, tokens: tokenData } = data.data;

      setUser(userData);
      setTokens(tokenData);
      localStorage.setItem("auth_tokens", JSON.stringify(tokenData));
      localStorage.setItem("auth_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      if (tokens?.refreshToken) {
        await fetch("http://localhost:3000/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthState();
      setIsLoading(false);
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    if (!tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      await refreshTokenFromStorage(tokens.refreshToken);
    } catch (error) {
      console.error("Token refresh error:", error);
      clearAuthState();
      throw error;
    }
  };

  // Update user function
  const updateUser = async (userData: Partial<User>) => {
    if (!tokens?.accessToken) {
      throw new Error("No access token available");
    }

    try {
      const response = await fetch("http://localhost:3000/auth/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Profile update failed");
      }

      const updatedUser = data.data.user;
      setUser(updatedUser);
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
