import React from "react";
import {
  Box,
  Avatar,
  Button,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { DoneAll, Visibility } from "@mui/icons-material";

export const MessageItem = React.memo(({ message, isMe, currentUser }) => {
  // Get sender name - handle both object and string senders
  let senderName = "";
  if (typeof message.sender === "object") {
    senderName = [message.sender.first_name, message.sender.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  } else if (typeof message.sender === "string") {
    senderName = message.sender;
  }

  // Get message content and time
  const messageContent = message.content || message.text || "";
  const messageTime =
    message.timestamp || message.time || new Date().toLocaleTimeString();

  return (
    <Box
      display="flex"
      justifyContent={isMe ? "flex-end" : "flex-start"}
      mb={1}
    >
      {!isMe && (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            mt: 0.5,
          }}
        >
          {senderName ? senderName.charAt(0) : ""}
        </Avatar>
      )}

      <Box
        // onClick={(e) => handleMessageClick(e, message, index)}
        sx={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: message.sender === "me" ? "flex-end" : "flex-start",
          maxWidth: "80%",
          position: "relative",
        }}
      >
        {!isMe && senderName && (
          <Typography
            variant="caption"
            sx={{ mb: 0.3, color: "#888", fontWeight: 500, fontSize: "11px" }}
          >
            {senderName}
          </Typography>
        )}
        <Box
          bgcolor={isMe ? "orange" : "#f5f5f5"}
          color={isMe ? "white" : "black"}
          p={1.5}
          borderRadius={isMe ? "10px 10px 0 10px" : "10px 10px 10px 0"}
          sx={{
            wordBreak: "break-word",
            maxWidth: "100%",
          }}
        >
          {messageContent &&
          typeof messageContent === "string" &&
          messageContent.startsWith("http") ? (
            <Link
              href={messageContent}
              target="_blank"
              rel="noopener"
              color="inherit"
            >
              {messageContent}
            </Link>
          ) : (
            <Typography fontSize="14px">{messageContent}</Typography>
          )}
          {message.image && (
            <img
              src={message.image}
              alt="uploaded"
              style={{
                maxWidth: "100%",
                height: "auto",
                marginTop: "5px",
                borderRadius: "8px",
                maxHeight: "200px",
              }}
            />
          )}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            mt={0.5}
          >
            <Typography fontSize="10px" mr={0.5}>
              {new Date(messageTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
            {isMe &&
              (message.is_read ? (
                <Visibility fontSize="small" sx={{ fontSize: "14px" }} />
              ) : (
                <DoneAll fontSize="small" sx={{ fontSize: "14px" }} />
              ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
