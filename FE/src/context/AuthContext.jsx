// src/Login/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchChatRooms, fetchUsers } from "../services/ChatStore";
import { DEV_BASE_URL } from "../ApiConfig";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores user data if logged in
  const [loading, setLoading] = useState(true); // To handle initial loading/check for stored token

  // On component mount, check for a stored token or user session
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user data:", e);
        localStorage.removeItem("user");
      }
    }
    setLoading(false); // Authentication check complete
  }, []);

  const login = async (email, password, rememberMe, loginMode) => {
    try {
      // Ensure we have the raw email string, not an object
      const emailStr =
        email && typeof email === "object"
          ? email.target?.value || ""
          : String(email || "").trim();
      const passwordStr =
        password && typeof password === "object"
          ? password.target?.value
          : String(password || "");

      if (!emailStr) {
        throw new Error("Email is required");
      }
      if (!passwordStr) {
        throw new Error("Password is required");
      }

      // Determine if it's an admin or user login
      const isAdminLogin =
        emailStr.endsWith("@innovatorstech.com") &&
        (emailStr.startsWith("admin") ||
          emailStr.startsWith("venkateswararao") ||
          emailStr.includes("garikapati"));

      const endpoint =
        loginMode === "admin"
          ? `${DEV_BASE_URL}/api/auth/login/admin/`
          : `${DEV_BASE_URL}/api/auth/login/user/`;

      console.log("Attempting login with:", { endpoint, email: emailStr });

      // Try different request formats - the backend might expect different field names
      const requestBodies = [
        // Try with email/password (as per your working example)
        { email: emailStr, password: passwordStr },
        // Try with username/password
        { username: emailStr, password: passwordStr },
        // Try with both email and username
        { email: emailStr, username: emailStr, password: passwordStr },
      ];

      let response;
      let lastError;

      // Try each request format until one works
      for (const body of requestBodies) {
        console.log("Trying login with body:", JSON.stringify(body, null, 2));

        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
            credentials: "include",
          });

          const data = await response.json();

          console.log("✅ [Auth] Login successful");
          console.log("Login response:", { status: response.status, data });
          console.log("response", response);
          console.log("isrespose ok ", response.ok);
          if (response.ok) {
            return await handleSuccessfulLogin(
              data,
              emailStr,
              isAdminLogin,
              rememberMe
            );
          } else {
            lastError = {
              status: response.status,
              statusText: response.statusText,
              data,
              error: data.detail || data.message || "Invalid credentials",
            };
            console.log("Attempt failed, trying next format...");
          }
        } catch (error) {
          lastError = error;
          console.log("Request failed, trying next format...", error);
          continue;
        }
      }

      // If we get here, all attempts failed
      console.error("All login attempts failed. Last error:", lastError);
      throw new Error(
        lastError.error || "Login failed. Please check your credentials."
      );
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };
  const handleSuccessfulLogin = async (
    data,
    email,
    isAdminLogin,
    rememberMe
  ) => {
    console.log("🔄 [Auth] Starting handleSuccessfulLogin");

    // 1. Store tokens
    if (data.access && data.refresh) {
      console.log("🔑 [Auth] Storing tokens");
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
    }

    // 2. Construct user data
    const userData = {
      id: data.user?.id,
      email: data.user?.email || email,
      firstName: data.user?.first_name || "",
      lastName: data.user?.last_name || "",
      username: data.user?.username || email.split("@")[0],
      isStaff: data.user?.is_staff || false,
      isSuperuser: data.user?.is_superuser || false,
      accessToken: data.access,
      refreshToken: data.refresh,
    };

    console.log("👤 [Auth] User data prepared:", {
      id: userData.id,
      email: userData.email,
      username: userData.username,
    });

    // 3. Save user
    setUser(userData);
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("user", JSON.stringify(userData));
    storage.setItem("access_token", data.access);
    storage.setItem("refresh_token", data.refresh);
    storage.setItem("user_id", userData.id.toString());
    storage.setItem("user", JSON.stringify(userData));

    console.log("👤 [Auth] User data saved:", {
      id: userData.id,
      email: userData.email,
      username: userData.username,
    });
    // 4. Fetch chat rooms and users after login
    console.log("🔄 [Auth] Starting to fetch chat data...");
    try {
      // These will update the Zustand store
      await Promise.all([
        fetchChatRooms(userData.id).then((data) => {
          console.log(`✅ [Auth] Fetched ${data?.length || 0} chat rooms`);
          return data;
        }),
        fetchUsers().then((users) => {
          console.log(`✅ [Auth] Fetched ${users?.length || 0} users`);
          return users;
        }),
      ]);
      console.log("✅ [Auth] Successfully loaded all chat data");
    } catch (e) {
      console.error("❌ [Auth] Error in chat data initialization:", {
        message: e.message,
        stack: e.stack,
        response: e.response?.data,
      });
      // We don't want to fail the login if chat data fails to load
    }

    console.log("✅ [Auth] Login process completed");
    return userData;
  };

  const logout = () => {
    // Clear all auth related data
    setUser(null);

    // Clear both storage types to be safe
    ["localStorage", "sessionStorage"].forEach((storageType) => {
      try {
        const storage = window[storageType];
        storage.removeItem("user");
        storage.removeItem("access_token");
        storage.removeItem("refresh_token");
      } catch (e) {
        console.error(`Error clearing ${storageType}:`, e);
      }
    });
  };

  const isAuthenticated = () => !!user;
  const isAdmin = () => user && user.role === "admin";
  const isEmployee = () => user && user.role === "employee";

  // Provide a way to get the user's role
  const getUserRole = () => (user ? user.role : null);

  const resetPassword = async (token, newPassword) => {
    try {
      const response = await fetch(
        `${DEV_BASE_URL}/api/auth/reset-password/${token}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            new_password: newPassword,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to reset password");
      }

      return await response.json();
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  };

  const contextValue = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isEmployee,
    getUserRole,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {loading ? <div>Loading authentication...</div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
