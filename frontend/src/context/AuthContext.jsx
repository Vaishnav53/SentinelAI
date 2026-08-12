import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await apiClient.get('/auth/me');
      setUser(userData);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    try {
      const userData = await apiClient.post('/auth/login', { username, password });
      setUser(userData);
      return userData;
    } catch (err) {
      throw err;
    }
  };

  const register = async (username, email, password) => {
    try {
      const userData = await apiClient.post('/auth/register', { username, email, password });
      setUser(userData);
      return userData;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.warn('Logout request failed or session already invalid:', err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    authenticated: !!user,
    login,
    register,
    logout,
    refreshUser: checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
