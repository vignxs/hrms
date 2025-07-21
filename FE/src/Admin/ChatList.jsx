import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Card,
  Badge,
  CircularProgress,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  List,
  ListItem,
} from "@mui/material";
import PersonOutlineSharpIcon from "@mui/icons-material/PersonOutlineSharp";
import MoreHorizSharp from "@mui/icons-material/MoreHorizSharp";
import PermIdentityOutlined from "@mui/icons-material/PermIdentityOutlined";

import {
  Search,
  Image as ImageIcon,
  Close,
  LocationOn,
  Language,
  GroupAdd,
} from "@mui/icons-material";
import { DEV_BASE_URL } from '../ApiConfig';
const ChatList = ({ onUserSelect, isMobile }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const searchInputRef = useRef();
  const [leftSideMenuAnchor, setLeftSideMenuAnchor] = useState(null);
  const [tempProfileData, setTempProfileData] = useState({});

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const response = await axios.get(`${DEV_BASE_URL}/api/auth/me/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCurrentUser(response.data);
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch users list
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const response = await axios.get(`${DEV_BASE_URL}/api/users/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUsers(response.data);
        setFilteredUsers(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users");
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm?.trim()) {
      setFilteredUsers(users);
      return;
    }

    const searchTermLower = searchTerm.toLowerCase().trim();
    const filtered = users.filter((user) => {
      if (!user) return false;
      
      const name = String(user.name || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const username = String(user.username || '').toLowerCase();
      const first_name = String(user.first_name || '').toLowerCase();
      const last_name = String(user.last_name || '').toLowerCase();
      
      return (
        name.includes(searchTermLower) ||
        email.includes(searchTermLower) ||
        username.includes(searchTermLower) ||
        first_name.includes(searchTermLower) ||
        last_name.includes(searchTermLower)
      );
    });
    
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleMenuClick = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleSearchClick = () => {
    setShowSearch(true);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setShowSearch(false);
  };

  const handleUserClick = async (user) => {
    console.log("User clicked:", user);
    const token = localStorage.getItem("access_token");
    // Use sessionStorage instead of localStorage for user ID
    let currentUserId = sessionStorage.getItem("user_id");
    
    console.log("TOKEN:", token);
    console.log("USER ID from session:", currentUserId);
    
    if (!token || !currentUserId) {
      console.error("Authentication error: Missing token or user ID");
      return;
    }

    try {
      console.log("Checking for existing chat room between users:", {
        current_user_id: currentUserId,
        other_user_id: user.id,
      });

      // Get all chat rooms for the current user
      const response = await axios.get(
        `${DEV_BASE_URL}/api/chat/rooms/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Find if there's already a direct chat room with the selected user
      const existingRoom = response.data.find((room) => {
        if (room.room_type !== "direct" || !room.participants) return false;

        const participantIds = room.participants.map((p) => p.id);
        return (
          participantIds.includes(parseInt(currentUserId)) &&
          participantIds.includes(parseInt(user.id)) &&
          participantIds.length === 2
        );
      });

      let room;

      if (existingRoom) {
        console.log("Found existing room:", existingRoom);
        room = existingRoom;
      } else {
        console.log("No existing room found, creating a new one");
        // Create a new room if none exists
        const createResponse = await axios.post(
          `${DEV_BASE_URL}/api/chat/rooms/`,
          {
            participants: [parseInt(currentUserId), parseInt(user.id)],
            room_type: "direct",
            name: null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        room = createResponse.data;
        console.log("Created new room:", room);
      }

      if (onUserSelect) {
        console.log("Calling onUserSelect with:", {
          ...user,
          roomId: room.id,
        });
        onUserSelect({
          ...user,
          roomId: room.id,
        });
      }

      setSelectedUser(user);
    } catch (error) {
      console.error("Error in handleUserClick:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });
    }
  };

  const handleProfileOpen = () => {
    setTempProfileData({
      name: selectedUser.name,
      role: selectedUser.role,
      about: selectedUser.about,
      location: selectedUser.location,
      memberSince: selectedUser.memberSince,
      language: selectedUser.language,
      status: selectedUser.status,
    });
    setShowProfile(true);
    handleMenuClose();
  };

  const handleProfileClose = () => {
    const updatedUser = {
      ...selectedUser,
      ...tempProfileData,
      description:
        tempProfileData.status === "Active"
          ? "Active"
          : tempProfileData.status === "Do Not Disturb"
          ? "Do Not Disturb"
          : tempProfileData.status === "Away"
          ? "Away"
          : "Offline",
      online: tempProfileData.status === "Active",
    };

    setSelectedUser(updatedUser);

    setUsers(
      users.map((user) => {
        if (user.id === updatedUser.id) {
          return updatedUser;
        }
        return user;
      })
    );

    setShowProfile(false);
  };
  const leftSideName = currentUser
    ? `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() ||
      currentUser.username
    : "User";

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setTempProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleLeftSideMenuClick = (event) => {
    setLeftSideMenuAnchor(event.currentTarget);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Card
      sx={{
        width: isMobile ? "98%" : "30%",
        height: isMobile ? "auto" : "calc(100vh - 130px)",
        mr: isMobile ? 0 : 2,
        p: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F5F6FA",
        overflow: "hidden",
      }}
    >
      {showProfile ? (
        /* Profile View */
        <Card
          sx={{
            p: 2,
            borderRadius: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <Box display="flex" justifyContent="flex-end" mb={0}>
            <IconButton onClick={handleProfileClose}>
              <Close />
            </IconButton>
          </Box>

          <Box display="flex" flexDirection="column" alignItems="center" mb={0}>
            <Box position="relative" display="inline-block">
              <Avatar sx={{ width: 60, height: 60 }}>
                {tempProfileData.name ? tempProfileData.name.charAt(0) : ""}
              </Avatar>
            </Box>
            <Typography variant="h6" fontWeight="bold" mt={0.5}>
              {tempProfileData.name}
            </Typography>
            <Typography color="textSecondary" fontSize={12}>
              {tempProfileData.role}
            </Typography>
          </Box>

          <Box mb={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              About Me
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              variant="outlined"
              name="about"
              value={tempProfileData.about || ""}
              onChange={handleProfileChange}
              placeholder="Write some description"
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: "60px",
                  alignItems: "flex-start",
                },
              }}
            />
          </Box>

          <Box mb={1}>
            <List disablePadding>
              <ListItem
                disableGutters
                sx={{ display: "flex", justifyContent: "space-between" }}
              >
                <Box display="flex" alignItems="center">
                  <LocationOn
                    sx={{
                      width: 24,
                      height: 24,
                      mr: 1,
                      bgcolor: "white",
                      borderRadius: "50%",
                      p: 0.5,
                    }}
                  />
                  <Typography>Location</Typography>
                </Box>
                <Typography>
                  {tempProfileData.location || "Not specified"}
                </Typography>
              </ListItem>

              <ListItem
                disableGutters
                sx={{ display: "flex", justifyContent: "space-between" }}
              >
                <Box display="flex" alignItems="center">
                  <PermIdentityOutlined
                    sx={{
                      width: 24,
                      height: 24,
                      mr: 1,
                      bgcolor: "white",
                      borderRadius: "50%",
                      p: 0.5,
                    }}
                  />
                  <Typography>Member since</Typography>
                </Box>
                <Typography>
                  {tempProfileData.memberSince || "Not specified"}
                </Typography>
              </ListItem>

              <ListItem
                disableGutters
                sx={{ display: "flex", justifyContent: "space-between" }}
              >
                <Box display="flex" alignItems="center">
                  <Language
                    sx={{
                      width: 24,
                      height: 24,
                      mr: 1,
                      bgcolor: "white",
                      borderRadius: "50%",
                      p: 0.5,
                    }}
                  />
                  <Typography>Language</Typography>
                </Box>
                <Typography>
                  {tempProfileData.language || "Not specified"}
                </Typography>
              </ListItem>
            </List>
          </Box>

          <Box mb={1}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Status
            </Typography>
            <RadioGroup
              name="status"
              value={tempProfileData.status || "Active"}
              onChange={handleProfileChange}
            >
              <FormControlLabel
                value="Active"
                control={
                  <Radio
                    sx={{
                      color: "orange",
                      "&.Mui-checked": { color: "orange" },
                    }}
                  />
                }
                label="Active"
              />
              <FormControlLabel
                value="Do Not Disturb"
                control={
                  <Radio
                    sx={{
                      color: "orange",
                      "&.Mui-checked": { color: "orange" },
                    }}
                  />
                }
                label="Do Not Disturb"
              />
              <FormControlLabel
                value="Away"
                control={
                  <Radio
                    sx={{
                      color: "orange",
                      "&.Mui-checked": { color: "orange" },
                    }}
                  />
                }
                label="Away"
              />
              <FormControlLabel
                value="Offline"
                control={
                  <Radio
                    sx={{
                      color: "orange",
                      "&.Mui-checked": { color: "orange" },
                    }}
                  />
                }
                label="Offline"
              />
            </RadioGroup>
          </Box>
        </Card>
      ) : (
        /* Chat List View */
        <>
          <Card
            elevation={3}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              bgcolor: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Top User Info with bottom border */}
            <Box
              sx={{
                p: 1,
                borderBottom: "1px solid #e0e0e0",
                bgcolor: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box display="flex" alignItems="center">
                <Box position="relative">
                  <Avatar sx={{ width: 40, height: 40 }}>
                    {leftSideName ? leftSideName.charAt(0) : ""}
                  </Avatar>
                  <Box
                    position="absolute"
                    bottom={0}
                    right={0}
                    width="10px"
                    height="10px"
                    bgcolor="green"
                    borderRadius="50%"
                    border="2px solid white"
                  />
                </Box>
                <Box ml={1}>
                  <Typography fontWeight="bold" fontSize="14px">
                    {leftSideName}
                  </Typography>
                  <Typography fontSize="12px" color="textSecondary">
                    Active
                  </Typography>
                </Box>
              </Box>
              <Box>
                <IconButton onClick={() => setShowSearch(!showSearch)}>
                  <Search />
                </IconButton>
                <IconButton onClick={handleLeftSideMenuClick}>
                  <MoreHorizSharp />
                </IconButton>
                <Menu
                  anchorEl={leftSideMenuAnchor}
                  open={Boolean(leftSideMenuAnchor)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleProfileOpen}>
                    <PersonOutlineSharpIcon sx={{ mr: 1 }} /> Profile
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setShowGroupDialog(true);
                      handleMenuClose();
                    }}
                  >
                    <GroupAdd sx={{ mr: 1 }} /> Create Group
                  </MenuItem>
                </Menu>
              </Box>
            </Box>

            {/* Search Bar - Conditionally rendered */}
            {showSearch && (
              <Box
                sx={{
                  p: 0.5,
                  borderBottom: "1px solid #e0e0e0",
                  bgcolor: "white",
                }}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  bgcolor="#fff"
                  p={1}
                  borderRadius="8px"
                >
                  <Search fontSize="small" />
                  <InputBase
                    placeholder="Search..."
                    fullWidth
                    inputRef={searchInputRef}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ ml: 2 }}
                    onBlur={() => {
                      if (searchTerm === "") {
                        setShowSearch(false);
                      }
                    }}
                  />
                  <IconButton
                    onClick={() => {
                      setSearchTerm("");
                      setShowSearch(false);
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )}

            {/* Chat List */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 1,
              }}
            >
              {filteredUsers.map((user) => (
                <Box
                  key={user.id}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  p={1.5}
                  mb={1}
                  borderRadius="8px"
                  bgcolor={
                    selectedUser && selectedUser.id === user.id
                      ? "#f5f5f5"
                      : "transparent"
                  }
                  sx={{
                    cursor: "pointer",
                    ":hover": { bgcolor: "#f0f0f0" },
                    transition: "background-color 0.2s ease",
                  }}
                  onClick={() => {
                    handleUserClick(user);
                    console.log("user", user);
                  }}
                >
                  <Box display="flex" alignItems="center">
                    <Box position="relative">
                      <Avatar sx={{ width: 40, height: 40 }}>
                        {user.first_name ? user.first_name.charAt(0) : ""}
                      </Avatar>
                      <Box
                        position="absolute"
                        bottom={0}
                        right={0}
                        width="10px"
                        height="10px"
                        bgcolor={user.online ? "green" : "red"}
                        borderRadius="50%"
                        border="2px solid white"
                      />
                    </Box>
                    <Box ml={1.5}>
                      <Typography fontWeight="bold" fontSize="14px">
                        {`${user.first_name || ""} ${
                          user.last_name || ""
                        }`.trim() || "Unknown User"}
                      </Typography>
                      <Typography
                        fontSize="12px"
                        color="textSecondary"
                        noWrap
                        sx={{
                          maxWidth: isMobile ? "150px" : "180px",
                          display: "block",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {user.messages && user.messages.length > 0
                          ? user.messages[user.messages.length - 1].text
                          : ""}
                      </Typography>
                    </Box>
                  </Box>
                  <Box textAlign="right" ml={1}>
                    <Typography fontSize="10px" color="textSecondary">
                      {user.time}
                    </Typography>
                    {user.unread > 0 && (
                      <Badge
                        badgeContent={user.unread}
                        color="warning"
                        sx={{
                          mt: 0.5,
                          "& .MuiBadge-badge": {
                            right: -5,
                            top: 5,
                          },
                        }}
                      />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Card>
        </>
      )}
    </Card>
  );
};

export default ChatList;
