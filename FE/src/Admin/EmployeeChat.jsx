import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Alert,
} from "@mui/material";
import axios from "axios";
import ChatList from "./ChatList";
import Chat from "./Chat";
import { DEV_BASE_URL } from '../ApiConfig';
const EmployeeChat = () => {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const fileInputRef = useRef();
  const searchInputRef = useRef();
  const socket = useRef(null);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);
  // Handle WebSocket connection and messages

  useEffect(() => {
    if (!currentRoomId) return;

    // First, fetch historical messages via REST API
    fetchMessages(currentRoomId);

    // Then set up WebSocket for real-time updates
    const ws_scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const ws_url = `${ws_scheme}://${window.location.hostname}:8001/ws/chat/${currentRoomId}/`;

    console.log("Attempting to connect to WebSocket:", ws_url);
    socket.current = new WebSocket(ws_url);

    socket.current.onopen = () => {
      console.log("✅ WebSocket Connected");
      // Mark historical messages as loaded once WebSocket is connected
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          isHistorical: false,
        }))
      );
    };

    socket.current.onerror = (error) => {
      console.error("❌ WebSocket Error:", error);
      // setIsLoadingMessages(false);
    };

    socket.current.onclose = (event) => {
      console.log("🔌 WebSocket Disconnected:", event.code, event.reason);
      // setIsLoadingMessages(false);
    };

    socket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
    
        if (data.type === "user_status") {
          console.log("🔔 Received user status:", data);
          const updatedUsers = users.map((user) =>
            user.id === data.user_id ? { ...user, online: data.is_online, description: data.is_online ? 'Online' : 'Offline' } : user
          );
          setUsers(updatedUsers);
    
          // Update selectedUser too if it's the same user
          if (selectedUser && selectedUser.id === data.user_id) {
            setSelectedUser({
              ...selectedUser,
              online: data.is_online,
              description: data.is_online ? 'Online' : 'Offline',
            });
          }
        }
    
        if (data.message || data.type === "chat") {
          const isFromMe = data.sender_id === currentUser?.id;
          const formattedMsg = {
            id: data.id,
            content: data.message,
            sender: { id: data.sender_id },
            timestamp: data.timestamp,
            is_me: isFromMe,
          };
    
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === formattedMsg.id);
            return exists ? prev : [...prev, formattedMsg];
          });
        }
    
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    

    return () => {
      if (socket.current) {
        console.log("Cleaning up WebSocket");
        socket.current.close();
      }
    };
  }, [currentRoomId]);

  const fetchMessages = async (roomId) => {
    if (!roomId) return;

    console.log(`[DEBUG] Fetching messages for room ${roomId}`);
    setIsLoadingMessages(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await axios.get(
        `${DEV_BASE_URL}/api/rooms/${roomId}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("[DEBUG] Messages response:", response.data);
      // Store messages with a flag to identify them as historical
      const historicalMessages = response.data.map((msg) => ({
        ...msg,
        isHistorical: true,
      }));
      setMessages(historicalMessages);
      setIsLoadingMessages(false);
    } catch (error) {
      console.error("[DEBUG] Error fetching messages:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
      }
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setError("Please log in to view users");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${DEV_BASE_URL}/api/users/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const formattedUsers = response.data.map((user) => ({
          id: user.id,
          name:
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.username,
          role: "User", // Default role, adjust if you have role information
          about: "",
          location: "",
          memberSince: "", // Add if available
          language: "English",
          status: "Offline",
          description: "Offline",
          time: "",
          online: false,
          unread: 0,
          messages: [],
          email: user.email,
          username: user.username, // Include username in case it's needed
        }));

        setUsers(formattedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(
          "Failed to load users. Please check your connection and try again."
        );
        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          // Optionally redirect to login
          // window.location.href = '/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [selectedUser]);

  // Add this effect to fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      console.log(
        "--------------------runing fetch current user   ----------------------------"
      );

      try {
        const response = await axios.get(`${DEV_BASE_URL}/api/auth/me/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        setCurrentUser(response.data);
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleUserSelect = (userData) => {
    console.log("User selected with room data:", userData);
    setSelectedUser(userData);

    // If we have a roomId in the user data, use it
    if (userData.roomId) {
      setCurrentRoomId(userData.roomId);
      fetchMessages(userData.roomId);
    }

    // If mobile view, you might want to close the user list here
    if (isMobile) {
      // Add mobile-specific logic if needed
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      height="100%"
      bgcolor="#Fff"
      p={0}
      flexDirection="column"
    >
      <Box
        display="flex"
        flex={1}
        gap={0}
        sx={{
          flexDirection: isMobile ? "column" : "row",
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar - Chat List */}
        <ChatList
          onUserSelect={handleUserSelect}
          isMobile={isMobile}
          selectedUser={selectedUser}
        />
        <Chat
          selectedUser={selectedUser}
          currentRoomId={currentRoomId}
          messages={messages}
          setMessages={setMessages}
          currentUser={currentUser}
          socket={socket.current}
        />
      </Box>
    </Box>
  );
};

export default EmployeeChat;
