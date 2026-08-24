import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import { getAttribution } from '../utils/attribution';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          // Validate token with backend
          const response = await authAPI.validateToken();
          setUser(response.data.user);
        } catch (error) {
          // Token is invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Login failed',
      };
    }
  };

  const register = async (data) => {
    try {
      // First-touch attribution, captured on the landing page and carried here
      // in sessionStorage. It is only ever present when the visitor accepted
      // the analytics cookie category — utils/attribution.js writes nothing
      // without consent, so an absent value here is the consent mechanism
      // working, not a bug.
      //
      // Sent as a nested object rather than spread into the payload so it can
      // never collide with, or be mistaken for, a registration field. The
      // server whitelists the eight keys it accepts and ignores the rest.
      const attribution = getAttribution();
      const response = await authAPI.register(
        attribution ? { ...data, attribution } : data
      );
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
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
