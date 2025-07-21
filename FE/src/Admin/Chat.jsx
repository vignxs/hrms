import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Avatar,
  TextField,
  Card,
  Button,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Send, ChatBubbleOutline } from "@mui/icons-material";

import axios from "axios";
import { MessageItem } from "./MessageItem";
import { DEV_BASE_URL } from '../ApiConfig';

const Chat = ({
  selectedUser,
  currentRoomId,
  messages,
  setMessages,
  currentUser,
  socket,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Local state
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef(null);
  // Fetch messages when roomId changes
  const fetchMessages = useCallback(async () => {
    if (!currentRoomId) {
      console.log('No room ID, skipping message fetch');
      return;
    }
    
    console.log('Fetching messages for room:', currentRoomId);
    setLoading(true);

    try {
      const response = await axios.get(
        `${DEV_BASE_URL}/api/rooms/${currentRoomId}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      console.log('Messages response:', response.data);
      
      const messageList = response.data.map((msg) => ({
        ...msg,
        is_me: msg.sender?.id === currentUser?.id,
      }));

      setMessages(messageList);
    } catch (error) {
      console.error("Error fetching messages:", error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
      });
    } finally {
      setLoading(false);
    }
  }, [currentRoomId, currentUser?.id, setMessages]);

  useEffect(() => {
    console.log('Current Room ID:', currentRoomId);
    console.log('Selected User:', selectedUser);
    if (currentRoomId) {
      console.log('Fetching messages for room:', currentRoomId);
    }
  }, [currentRoomId, selectedUser]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);


  // Handle message sending
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser) return;
  
    const newMessage = {
      message: messageInput,
      sender_id: currentUser?.id,
    };
  
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(newMessage));
    }
  
    setMessageInput("");
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  
  // Show welcome message when no user is selected
  if (!selectedUser) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
          textAlign: 'center',
          p: 3,
          bgcolor: '#F5F6FA',
          position: 'relative',
          margin: 'auto',
          maxWidth: '600px',
          '& > *': {
            maxWidth: '100%',
          }
        }}
      >
        <Box
          sx={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            bgcolor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <ChatBubbleOutline sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h6" color="textSecondary" gutterBottom sx={{ width: '100%' }}>
          Select a user to start chatting
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ width: '100%' }}>
          Choose a contact from the list to begin your conversation
        </Typography>
      </Box>
    );
  }

  return (
    <Card
      sx={{
        flex: 1,
        p: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F5F6FA",
        height: isMobile ? "calc(100vh - 120px)" : "calc(100vh - 130px)",
        maxHeight: isMobile ? "none" : "800px",
      }}
    >
      {/* Top Header */}
      <Card elevation={3} sx={{ p: 1, mb: 0.2, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <Box position="relative">
              <Avatar sx={{ width: 40, height: 40 }}>
                {selectedUser?.name?.charAt(0) || "U"}
              </Avatar>
              <Box
                position="absolute"
                bottom={0}
                right={0}
                width="10px"
                height="10px"
                bgcolor={selectedUser.online ? "green" : "red"}
                borderRadius="50%"
                border="2px solid white"
              />
            </Box>
            <Box ml={1}>
              <Typography fontWeight="bold">
                {`${selectedUser?.first_name || ""} ${
                  selectedUser?.last_name || ""
                }`.trim() || "Unknown User"}
              </Typography>
              <Typography fontSize="12px" color="textSecondary">
                {selectedUser.description || ""}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Card>

      {/* Chat Messages */}
      <Card
        elevation={3}
        sx={{
          p: 2,
          mb: 0.2,
          borderRadius: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box flex={1} sx={{ overflowY: "auto" }}>
          {messages && messages.length > 0 ? (
            messages.map((message, index) => {
              const isMe =
                message &&
                (message.sender?.id === currentUser?.id ||
                  message.is_me ||
                  (typeof message.sender === "string" &&
                    message.sender === "me"));

              return (
                <MessageItem
                  key={message.id || `${message.sender?.id}-${index}`}
                  message={message}
                  isMe={isMe}
                  currentUser={currentUser}
                />
              );
            })
          ) : (
            <Box textAlign="center" mt={isMobile ? 8 : 14}>
              <Typography mt={2} fontWeight="bold">
                {loading ? "Loading messages..." : "No messages yet"}
              </Typography>
              <Typography fontSize="12px" color="textSecondary">
                {loading
                  ? "Please wait while we load your chat history..."
                  : "Send a message to start the conversation"}
              </Typography>
            </Box>
          )}
            <Box ref={messagesEndRef} />

        </Box>
      </Card>

      {/* Send Message Box */}
      <Box
        display="flex"
        alignItems="center"
        bgcolor="#fff"
        p={1}
        borderRadius="8px"
        position="relative"
      >
        <TextField
          placeholder="Write a message..."
          variant="standard"
          fullWidth
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
        />
        <Button
          variant="contained"
          onClick={handleSendMessage}
          sx={{
            ml: 1,
            backgroundColor: "rgba(255, 140, 0, 1)",
            "&:hover": {
              backgroundColor: "rgba(255, 120, 0, 1)",
            },
          }}
          endIcon={<Send />}
        >
          Send
        </Button>
      </Box>
    </Card>
  );
};

export default Chat;
