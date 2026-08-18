import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { adminAuthAPI, adminErrorMessage, ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from '../services/adminApi';

/**
 * Session state for the platform administration panel.
 *
 * Separate from AuthContext on purpose: an administrator is not a trainer with
 * a flag, they are a row in a different table authenticated through a different
 * endpoint with a different token (backend/middleware/adminAuth.js). Keeping the
 * two contexts apart means neither can be mistaken for the other, and both can
 * be signed in at once in one browser.
 *
 * The stored admin object is used only to render a name and to decide which
 * buttons are worth showing. It is NOT the authorization boundary — the API
 * re-reads the role from the database on every single request, so a stale or
 * tampered copy here changes nothing about what the server will allow.
 */

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Revalidate any stored session against the server on mount. A token in
  // localStorage proves nothing — it may be expired, or belong to an account
  // that has since been deactivated — so the source of truth is /auth/me.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { data } = await adminAuthAPI.me();
        if (!cancelled) setAdmin(data.admin);
      } catch {
        // The interceptor already cleared storage on a 401. Anything else
        // (network, 500) also means we cannot vouch for the session.
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await adminAuthAPI.login(email, password);
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.admin));
      setAdmin(data.admin);
      return { success: true };
    } catch (error) {
      return { success: false, error: adminErrorMessage(error) };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setAdmin(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContext;
