import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('tripPanaTouristToken') || null;
  });

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('tripPanaTouristUser');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(true);

  // Restore & verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('tripPanaTouristToken');

      if (!storedToken) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem('tripPanaTouristUser', JSON.stringify(data.user));
        } else {
          // Token is invalid, expired, or non-tourist
          localStorage.removeItem('tripPanaTouristToken');
          localStorage.removeItem('tripPanaTouristUser');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Session verification network error:', error);
        // Retain local state offline if network temporarily fails, or clear if unresolvable
      } finally {
        setAuthLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('tripPanaTouristToken', newToken);
    localStorage.setItem('tripPanaTouristUser', JSON.stringify(newUser));
  };

  const register = (newToken, newUser) => {
    login(newToken, newUser);
  };

  const logout = () => {
    // Notify backend (optional fire-and-forget)
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST'
    }).catch(() => {});

    setToken(null);
    setUser(null);
    localStorage.removeItem('tripPanaTouristToken');
    localStorage.removeItem('tripPanaTouristUser');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        authLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
