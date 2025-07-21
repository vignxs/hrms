import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  InputAdornment,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import { FaFingerprint } from "react-icons/fa";
import {
  Search,
  Close,
  DescriptionOutlined,
  ChatBubbleOutline,
} from "@mui/icons-material";
import { styled, useTheme } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

const AttendanceCard = () => {
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [punchInTime, setPunchInTime] = useState(null);
  const [punchOutTime, setPunchOutTime] = useState(null);
  const [totalHours, setTotalHours] = useState("00:00:00");
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All");

  const [openReasonDialog, setOpenReasonDialog] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonType, setReasonType] = useState(""); // 'in' or 'out'

  const [openDailyReportDialog, setOpenDailyReportDialog] = useState(false);
  const [dailyReportMessage, setDailyReportMessage] = useState("");

  const [openReplyDialog, setOpenReplyDialog] = useState(false);
  const [latestReply, setLatestReply] = useState(
    "Thank you for submitting your daily report. Please ensure to punch in before 9:30 AM regularly."
  );

  const [userProfile, setUserProfile] = useState(null);
  const [userName, setUserName] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [reasonApprovalStatus, setReasonApprovalStatus] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper function to check if two dates are the same day
  const isSameDay = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Helper function to format time string for display
  const formatTime = (date) => {
    if (!date) return "-";
    // If it's a Date object, convert to string
    if (date instanceof Date) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    // If it's a string, parse and format
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper function to format date string for display
  const formatDate = (date) => {
    if (!date) return "-";
    // If it's a Date object, convert to string
    if (date instanceof Date) {
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    // If it's a string, parse and format
    const d = new Date(date);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Helper function to format hours
  const formatHours = (hours) => {
    if (!hours) return "00:00:00";
    if (typeof hours === "number") {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const s = Math.floor(((hours - h) * 60 - m) * 60);
      return `${h.toString().padStart(2, "0")}:${m
        .toString()
        .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return hours;
  };

  // Helper function to calculate hours from punch times
  const calculateHours = (punchIn, punchOut) => {
    if (!punchIn || !punchOut) return "00:00:00";

    const start = new Date(punchIn);
    const end = new Date(punchOut);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "00:00:00";

    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate current day's hours when punched in
  const calculateCurrentHours = (punchIn, punchOut) => {
    if (!punchIn) return "00:00:00";

    const start = new Date(punchIn);
    const end = punchOut ? new Date(punchOut) : new Date();

    if (isNaN(start.getTime()) || (punchOut && isNaN(end.getTime())))
      return "00:00:00";

    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get total hours from today's record
  const getTodayHours = () => {
    if (!attendanceRecords.today) return "00:00:00";
    return formatHours(attendanceRecords.today.hours_worked);
  };

  // Timer effect that runs only when punched in and not punched out
  useEffect(() => {
    if (isPunchedIn && !punchOutTime) {
      // Start timer immediately
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        const duration = elapsedSeconds * 1000;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);

        setTotalHours(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }, 1000);

      // Return cleanup function
      return () => clearInterval(timer);
    }
  }, [isPunchedIn, punchOutTime, elapsedSeconds]);

  // Update attendance table when punch-in/out changes
  useEffect(() => {
    if (isPunchedIn) {
      // Update table with current punch-in time
      setAttendanceData((prev) => [
        {
          id: Date.now(),
          date: formatDate(new Date()),
          punch_in: formatTime(new Date()),
          punch_out: "-",
          hours: "00:00:00",
          status: "Present",
          reason: "",
        },
        ...prev.filter((item) => item.date !== formatDate(new Date())),
      ]);
    } else if (punchOutTime) {
      // Update table with punch-out time and calculate hours
      setAttendanceData((prev) => {
        const updatedData = [...prev];
        const todayIndex = updatedData.findIndex(
          (item) => item.date === formatDate(new Date())
        );
        if (todayIndex !== -1) {
          updatedData[todayIndex] = {
            ...updatedData[todayIndex],
            punch_out: formatTime(new Date()),
            hours: totalHours,
            punch_out_reason: reasonText || "",
            punch_out_reason_status: "Pending",
            punch_out_admin_comment: "",
          };
        }
        return updatedData;
      });
    }
  }, [isPunchedIn, punchOutTime]);

  // Update hours when punch-out occurs
  useEffect(() => {
    if (punchOutTime) {
      const punchInDate = new Date(punchInTime);
      const punchOutDate = new Date(punchOutTime);
      const duration = punchOutDate.getTime() - punchInDate.getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((duration % (1000 * 60)) / 1000);
      setTotalHours(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }
  }, [punchOutTime]);

  // Calculate hours to display
  const hoursToDisplay = useMemo(() => {
    if (isPunchedIn) {
      return calculateCurrentHours(punchInTime, punchOutTime);
    } else {
      return getTodayHours();
    }
  }, [isPunchedIn, punchInTime, punchOutTime, getTodayHours]);

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          console.error("No authentication token found");
          return;
        }

        const response = await fetch("http://localhost:8000/api/auth/me/", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || "Failed to fetch user profile");
        }

        const profileData = await response.json();
        console.log("profile ndaya", JSON.stringify(profileData, null, 2));
        setUserProfile(profileData);
        setUserName(
          `${profileData.first_name || ""} ${
            profileData.last_name || ""
          }`.trim()
        );
        setEmployeeId(profileData.id);
        setReasonApprovalStatus(profileData.reason_approval_status || "");
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  // Load saved punch-in state from localStorage on component mount
  useEffect(() => {
    if (!employeeId) return; // Wait until we have the employee ID

    const getPunchInState = () => {
      const savedPunchIn = localStorage.getItem(`punchInState_${employeeId}`);
      if (savedPunchIn) {
        try {
          const { punchInTime: savedPunchInTime, isPunchedIn } =
            JSON.parse(savedPunchIn);
          if (savedPunchInTime && isPunchedIn) {
            const punchInDate = new Date(savedPunchInTime);
            // Only restore if it's from today
            if (isSameDay(punchInDate, new Date())) {
              setPunchInTime(punchInDate);
              setIsPunchedIn(true);
              return true;
            } else {
              // Clear old data if it's from a different day
              localStorage.removeItem(`punchInState_${employeeId}`);
            }
          }
        } catch (e) {
          console.error("Error parsing saved punch-in state:", e);
          localStorage.removeItem(`punchInState_${employeeId}`);
        }
      }
      return false;
    };

    // Clear any old format storage that wasn't user-specific
    const oldPunchInState = localStorage.getItem("punchInState");
    if (oldPunchInState) {
      localStorage.removeItem("punchInState");
    }

    getPunchInState();
  }, [employeeId]);

  // Save punch-in state to localStorage whenever it changes
  useEffect(() => {
    if (!employeeId || !punchInTime) return; // Don't save if we don't have an employee ID yet

    localStorage.setItem(
      `punchInState_${employeeId}`,
      JSON.stringify({
        punchInTime: punchInTime,
        isPunchedIn: true,
      })
    );
  }, [punchInTime, employeeId]);

  const [attendanceData, setAttendanceData] = useState([]);

  // State for Calendar Notes
  const [calendarNotes, setCalendarNotes] = useState({
    // Example notes: Format 'YYYY-MM-DD': 'Your note here'
    "2025-07-08": "Team Sync Up",
    "2025-07-15": "Project Deadline",
    "2025-07-22": "Client Meeting",
  });
  const [selectedDateForNote, setSelectedDateForNote] = useState(null);
  const [noteDialogText, setNoteDialogText] = useState("");
  const [openNoteDialog, setOpenNoteDialog] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [isPunchingIn, setIsPunchingIn] = useState(false);
  const [isPunchingOut, setIsPunchingOut] = useState(false);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      return "Good Morning";
    } else if (hour >= 12 && hour < 17) {
      return "Good Afternoon";
    } else {
      return "Good Evening";
    }
  };

  // Fetch late login reasons from API
  useEffect(() => {
    fetchLateLoginReasons();
  }, []);

  // Fetch function
  const fetchLateLoginReasons = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        "http://localhost:8000/api/late-login-reasons/",
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await response.json();
      console.log("Late login reasons data:", data);
      const mapped = Array.isArray(data)
        ? data.map((item) => ({
            id: item.id,
            date: item.login_time
              ? new Date(item.login_time).toLocaleDateString("en-GB")
              : "-",
            punch_in: item.login_time
              ? new Date(item.login_time).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "-",
            punch_out: "-",
            hours: "-",
            status: item.is_approved === true ? "Present" : "Leave",
            reason: item.reason
              ? `${item.reason} (${
                  item.is_approved === true
                    ? "Approved"
                    : item.is_approved === false
                    ? "Not Approved"
                    : "Pending"
                })`
              : "-",
          }))
        : [];
      setAttendanceData(mapped);
    } catch (e) {
      console.error("Failed to fetch late login reasons:", e);
      setAttendanceData([]);
    }
  };

  // // Post late login reason
  // const postLateLoginReason = async (reasonText) => {
  //   try {
  //     const token = localStorage.getItem("access_token");
  //     const response = await fetch(
  //       "http://localhost:8000/api/late-login-reasons/",
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //         },
  //         body: JSON.stringify({ reason: reasonText }),
  //       }
  //     );
  //     if (response.ok) {
  //       await fetchLateLoginReasons();
  //       alert("Reason submitted successfully!");
  //       setOpenReasonDialog(false);
  //       setReasonText("");
  //     } else {
  //       alert("Failed to submit reason");
  //     }
  //   } catch (e) {
  //     console.error("Error submitting reason:", e);
  //     alert("Error submitting reason");
  //   }
  // };

  // Send daily report
  const sendDailyReport = async (reportText) => {
    try {
      const token = localStorage.getItem("access_token");
      const today = new Date();
      const formattedDate = today.toISOString().slice(0, 10);
      const payload = {
        work_details: reportText,
        date: formattedDate,
      };
      const response = await fetch(
        "http://localhost:8000/api/daily-work-reports/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) {
        alert("Daily report sent successfully!");
        setDailyReportMessage("");
        setOpenDailyReportDialog(false);
      } else {
        alert("Failed to send daily report");
      }
    } catch (e) {
      console.error("Error sending daily report:", e);
      alert("Error sending daily report");
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isPunchedIn && punchInTime) {
        const now = new Date();
        // Convert punchInTime string to Date object
        const punchInDate = new Date(punchInTime);
        const duration = now.getTime() - punchInDate.getTime();
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        setTotalHours(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
        setElapsedSeconds(Math.floor(duration / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPunchedIn, punchInTime]);

  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const maxSeconds = 8 * 60 * 60; // 8 hours for a full circle
  const progress = Math.min(elapsedSeconds / maxSeconds, 1);
  const strokeDashoffset = circumference - progress * circumference;

  const StyledPaper = styled(Paper)(({ theme }) => ({
    width: 320,
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.grey[200]}`,
    boxShadow: theme.shadows[2],
    textAlign: "center",
  }));

  const filteredAttendance = useMemo(() => {
    return attendanceData.filter((record) => {
      // Filter by status
      if (filter !== "All" && record.status !== filter) return false;

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          record.date.toLowerCase().includes(searchLower) ||
          record.punchIn.toLowerCase().includes(searchLower) ||
          record.punchOut.toLowerCase().includes(searchLower) ||
          record.status.toLowerCase().includes(searchLower) ||
          (record.reason || "").toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [attendanceData, filter, searchTerm]);

  const lightOrange = "#FFDAB9";
  const mediumOrange = "#FFA07A";

  // --- Calendar Note Functions ---
  const handleDayClick = (date) => {
    const dateKey = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    setSelectedDateForNote(date);
    setNoteDialogText(calendarNotes[dateKey] || ""); // Load existing note or empty string
    setOpenNoteDialog(true);
  };

  const handleSaveNote = () => {
    if (selectedDateForNote) {
      const dateKey = selectedDateForNote.toISOString().slice(0, 10);
      setCalendarNotes((prev) => {
        const newNotes = { ...prev };
        if (noteDialogText.trim()) {
          newNotes[dateKey] = noteDialogText.trim();
        } else {
          delete newNotes[dateKey]; // Remove note if text is empty
        }
        return newNotes;
      });
    }
    setOpenNoteDialog(false);
    setNoteDialogText("");
    setSelectedDateForNote(null);
  };

  const handleCloseNoteDialog = () => {
    setOpenNoteDialog(false);
    setNoteDialogText("");
    setSelectedDateForNote(null);
  };
  // --- End Calendar Note Functions ---
  const fetchPunchRecords = async () => {
    if (!employeeId) {
      console.log("No employee ID available");
      setLoading(false);
      setAttendanceRecords([]);
      return;
    }

    try {
      console.log("Fetching punch records for employee ID:", employeeId);

      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No JWT token found");
        setLoading(false);
        setAttendanceRecords([]);
        return;
      }

      const response = await fetch(
        `http://localhost:8000/api/attendance/punch-records/${employeeId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Raw response data:", data);

        // Extract records array from response
        const records = data.records || [];

        // Format all records from the database
        const formattedRecords = records.map((record, index) => ({
          id: `record_${record.id}`,
          date: record.date || new Date().toISOString().split("T")[0],
          dateDisplay: formatDate(record.date),
          username: record.user_name,
          punch_in: record.punch_in || record.punch_in_time,
          punch_out: record.punch_out || record.punch_out_time,

          punch_in_display: formatTime(record.punch_in),
          punch_out_display: formatTime(record.punch_out),

          hours: calculateHours(
            record.punch_in || record.punch_in_time,
            record.punch_out || record.punch_out_time
          ),
          hoursDisplay: formatHours(
            calculateHours(
              record.punch_in || record.punch_in_time,
              record.punch_out || record.punch_out_time
            )
          ),

          punch_in_reason: record.punch_in_reason || "",
          punch_out_reason: record.punch_out_reason || "",
          punch_in_reason_status: record.punch_in_reason_status || "pending",
          punch_out_reason_status: record.punch_out_reason_status || "pending",

          punch_in_admin_comment: record.punch_in_admin_comment || "",
          punch_out_admin_comment: record.punch_out_admin_comment || "",

          status: record.status || "Pending",
          statusDisplay: record.status,

          user_name:
            record.user_name || data.user?.email?.split("@")[0] || "Unknown",

          is_late: record.is_late || false,
          hours_worked: record.hours_worked || "0h 0m",

          created_at: record.created_at,
        }));

        // Update state with formatted records
        setAttendanceRecords(formattedRecords);

        // Update today's punch status using todayRecord
        if (data.today) {
          setIsPunchedIn(!!data.today.punch_in || !!data.today.punch_in_time);
          setIsPunchOutDisabled(
            !!data.today.punch_out || !!data.today.punch_out_time
          );
          setPunchInTime(data.today.punch_in || data.today.punch_in_time);
          setPunchOutTime(data.today.punch_out || data.today.punch_out_time);
          setReasonApprovalStatus(data.today.reason_approval_status);
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to fetch punch records" }));
        console.error("Failed to fetch punch records:", errorData);
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error("Error fetching punch records:", error);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };
  // useEffect(() => {
  //   fetchPunchRecords();

  //   const interval = setInterval(() => {
  //     fetchPunchRecords();

  //   }, 10000); // 10,000 ms = 10 seconds
  //   return () => clearInterval(interval); // Cleanup interval on component unmount
  // },);
  useEffect(() => {
    const fetchPunchRecords = async () => {
      if (!employeeId) {
        console.log("No employee ID available");
        setLoading(false);
        setAttendanceRecords([]);
        return;
      }

      try {
        console.log("Fetching punch records for employee ID:", employeeId);

        const token = localStorage.getItem("access_token");
        if (!token) {
          console.error("No JWT token found");
          setLoading(false);
          setAttendanceRecords([]);
          return;
        }

        const response = await fetch(
          `http://localhost:8000/api/attendance/punch-records/${employeeId}/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Raw response data:", data);

          // Extract records array from response
          const records = data.records || [];

          // Format all records from the database
          const formattedRecords = records.map((record, index) => ({
            id: `record_${record.id}`,
            date: record.date || new Date().toISOString().split("T")[0],
            dateDisplay: formatDate(record.date),

            punch_in: record.punch_in || record.punch_in_time,
            punch_out: record.punch_out || record.punch_out_time,

            punch_in_display: formatTime(record.punch_in),
            punch_out_display: formatTime(record.punch_out),

            hours: calculateHours(
              record.punch_in || record.punch_in_time,
              record.punch_out || record.punch_out_time
            ),
            hoursDisplay: formatHours(
              calculateHours(
                record.punch_in || record.punch_in_time,
                record.punch_out || record.punch_out_time
              )
            ),

            punch_in_reason: record.punch_in_reason || "",
            punch_out_reason: record.punch_out_reason || "",
            punch_in_reason_status: record.punch_in_reason_status || "pending",
            punch_out_reason_status:
              record.punch_out_reason_status || "pending",

            punch_in_admin_comment: record.punch_in_admin_comment || "",
            punch_out_admin_comment: record.punch_out_admin_comment || "",

            status: record.status || "Pending",
            statusDisplay: record.status,

            user_name:
              record.user_name || data.user?.email?.split("@")[0] || "Unknown",

            is_late: record.is_late || false,
            hours_worked: record.hours_worked || "0h 0m",

            created_at: record.created_at,
          }));

          // Update state with formatted records
          setAttendanceRecords(formattedRecords);

          // Update today's punch status using todayRecord
          if (data.today) {
            setIsPunchedIn(!!data.today.punch_in || !!data.today.punch_in_time);
            setIsPunchOutDisabled(
              !!data.today.punch_out || !!data.today.punch_out_time
            );
            setPunchInTime(data.today.punch_in || data.today.punch_in_time);
            setPunchOutTime(data.today.punch_out || data.today.punch_out_time);
            setReasonApprovalStatus(data.today.reason_approval_status);
          }
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to fetch punch records" }));
          console.error("Failed to fetch punch records:", errorData);
          setAttendanceRecords([]);
        }
      } catch (error) {
        console.error("Error fetching punch records:", error);
        setAttendanceRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPunchRecords();
  }, [employeeId]);

  // Update the formatted attendance records to handle both cases
  const formattedAttendanceRecords = useMemo(() => {
    const recordsArray = Array.isArray(attendanceRecords)
      ? attendanceRecords
      : attendanceRecords?.records;

    if (!recordsArray || !Array.isArray(recordsArray)) return [];

    return recordsArray.map((record) => {
      // If hours is missing, calculate from punch_in and punch_out
      let computedHours = record.hours;
      if (
        (!record.hours || record.hours === 0) &&
        record.punch_in &&
        record.punch_out
      ) {
        const inTime = new Date(record.punch_in);
        const outTime = new Date(record.punch_out);
        const diffMs = outTime - inTime;

        if (!isNaN(diffMs) && diffMs > 0) {
          computedHours = diffMs / (1000 * 60 * 60); // convert ms to hours
        }
      }

      return {
        ...record,
        punchInDisplay: formatTime(record.punch_in_time),
        punchOutDisplay: formatTime(record.punch_out_time),
        dateDisplay: formatDate(record.date),
        hoursDisplay: formatHours(computedHours),
        statusDisplay: record.status,
        reasonDisplay: record.reason,
        punch_in_reason: record.punch_in_reason,
        punch_out_reason: record.punch_out_reason,
        punch_in_reason_status: record.punch_in_reason_status,
        punch_out_reason_status: record.punch_out_reason_status,
        user_nameDisplay: record.user_name,
        reasonApprovalStatus: record.reason_approval_status,
        adminComment: record.admin_comment,
        adminComment: record.admin_comment,
        approvedBy: record.approved_by,
      };
    });
  }, [attendanceRecords]);

  // console.log("formattedAttendanceRecords", formattedAttendanceRecords);
  // console.log("attendanceRecords", attendanceRecords);
  useEffect(() => {
    const fetchPunchStatus = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const profileResponse = await fetch(
          "http://localhost:8000/api/auth/me/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!profileResponse.ok) return;

        const profileData = await profileResponse.json();
        const employeeId = profileData.id;

        if (!employeeId) return;

        const response = await fetch(
          `http://localhost:8000/api/attendance/punch-records/${employeeId}/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.today) {
            const hasPunchedIn = data.today.has_punched_in;
            const hasPunchedOut = data.today.has_punched_out;

            setIsPunchedIn(hasPunchedIn);
            setIsPunchOutDisabled(hasPunchedOut);
            setPunchInTime(
              data.today.punch_in_time
                ? new Date(data.today.punch_in_time)
                : null
            );
            setPunchOutTime(
              data.today.punch_out_time
                ? new Date(data.today.punch_out_time)
                : null
            );
            setTotalHours(
              data.today.hours_worked ? data.today.hours_worked : "00:00:00"
            );
            setAttendanceData((prev) => [
              {
                ...prev[0],
                status: data.today.status,
                reason: data.today.reason,
                punchInTime: data.today.punch_in_time
                  ? new Date(data.today.punch_in_time)
                  : null,
                punchOutTime: data.today.punch_out_time
                  ? new Date(data.today.punch_out_time)
                  : null,
              },
              ...prev,
            ]);
          }
        }
      } catch (error) {
        console.error("Error fetching punch status:", error);
      }
    };

    fetchPunchStatus();
  }, []);

  // Update punch button state whenever attendance records change
  useEffect(() => {
    if (attendanceRecords.length > 0) {
      const today = new Date();
      const todayDate = today.toLocaleDateString("en-GB");
      const todayRecord = attendanceRecords.find((record) => {
        const recordDate = new Date(record.date);
        return recordDate.toLocaleDateString("en-GB") === todayDate;
      });

      if (todayRecord) {
        setIsPunchedIn(!!todayRecord.punchIn);
        setIsPunchOutDisabled(!!todayRecord.punchOut);
        setPunchInTime(todayRecord.punchIn);
        setPunchOutTime(todayRecord.punchOut);
      }
    }
  }, [attendanceRecords]);

  const updateAttendanceRecords = async (data) => {
    try {
      if (!employeeId) {
        console.error("No employee ID available");
        return;
      }

      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `http://localhost:8000/api/attendance/punch-records/${employeeId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const records = await response.json();
        setAttendanceRecords(records);
        console.log("Attendance records:", records);
      } else {
        console.error("Failed to fetch attendance records");
        const errorData = await response.json().catch(() => ({}));
        console.error("Error data:", errorData);
      }
    } catch (error) {
      console.error("Error updating attendance records:", error);
    }
  };

  const punchIn = async (reason = "") => {
    try {
      setIsPunchingIn(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Get employee profile
      const profileResponse = await fetch(
        "http://localhost:8000/api/auth/me/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!profileResponse.ok) {
        const error = await profileResponse.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to fetch user profile");
      }

      const profileData = await profileResponse.json();
      const employeeId = profileData.id;
      const now = new Date();
      const isLate =
        now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 30);

      // If late and no reason provided, show reason dialog
      if (isLate && !reason) {
        setReasonType("in");
        setOpenReasonDialog(true);
        return;
      }

      // Prepare request
      const requestBody = {
        punch_in_reason: reason || "",
      };

      const response = await fetch(
        `http://localhost:8000/api/attendance/punch-in/${employeeId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to punch in" }));
        throw new Error(errorData.error || "Failed to punch in");
      }

      const data = await response.json();
      setIsPunchedIn(true);
      setPunchInTime(now);
      setPunchOutTime(null); // Reset punch out time
      setElapsedSeconds(0); // Reset timer
      setTotalHours("00:00:00"); // Reset total hours

      fetchPunchRecords();
      setSuccess(`Successfully punched in at ${now.toLocaleTimeString()}`);

      // Update the attendance table data
      setAttendanceData((prev) => [
        {
          id: Date.now(),
          date: formatDate(now),
          punch_in: formatTime(now),
          punch_out: "-",
          hours: "00:00:00",
          status: isLate ? "Late" : "Present",
          punch_in_reason: reason || "",
          punch_in_reason_status: "Pending",
          punch_in_admin_comment: "",
        },
        ...prev,
      ]);

      // Update the records in the background
      await updateAttendanceRecords(data);
      return data;
    } catch (error) {
      console.error("Punch in error:", error);
      setError(error.message || "Failed to punch in");
      alert(error.message || "Error punching in");
    } finally {
      setIsPunchingIn(false);
    }
  };

  const punchOut = async (reason = "") => {
    try {
      setIsPunchingOut(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Get employee profile
      const profileResponse = await fetch(
        "http://localhost:8000/api/auth/me/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!profileResponse.ok) {
        const error = await profileResponse.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to fetch user profile");
      }

      const profileData = await profileResponse.json();
      const employeeId = profileData.id;
      const now = new Date();

      // If no punch in time, show error
      if (!punchInTime) {
        throw new Error("Cannot punch out without punching in first");
      }

      // If reason needed, show dialog
      if (!reason) {
        setReasonType("out");
        setOpenReasonDialog(true);
        return;
      }

      // Prepare request
      const requestBody = {
        punch_out_reason: reason || "",
      };

      const response = await fetch(
        `http://localhost:8000/api/attendance/punch-out/${employeeId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to punch out" }));
        throw new Error(errorData.error || "Failed to punch out");
      }

      const data = await response.json();

      setPunchOutTime(now);
      setIsPunchedIn(false);
      fetchPunchRecords();
      setSuccess(`Successfully punched out at ${now.toLocaleTimeString()}`);

      // Update the attendance table data
      setAttendanceData((prev) => {
        const updatedData = [...prev];
        if (updatedData.length > 0) {
          const todayIndex = updatedData.findIndex(
            (item) => item.date === formatDate(now)
          );
          if (todayIndex !== -1) {
            updatedData[todayIndex] = {
              ...updatedData[todayIndex],
              punch_out: formatTime(now),
              hours: calculateHours(punchInTime, now),
              status: "Present",
              punch_out_reason: reason || "",
              punch_out_reason_status: "Pending",
              punch_out_admin_comment: "",
            };
          }
        }
        return updatedData;
      });

      // Update the records in the background
      await updateAttendanceRecords(data);

      return data;
    } catch (error) {
      console.error("Punch out error:", error);
      setError(error.message || "Failed to punch out");
      alert(error.message || "Error punching out");
    } finally {
      setIsPunchingOut(false);
    }
  };

  const [isPunchOutDisabled, setIsPunchOutDisabled] = useState(false);

  const handlePunch = async () => {
    const now = new Date();

    // Check if we've already punched in and out today
    if (punchInTime && punchOutTime) {
      setIsPunchOutDisabled(true);
      return; // Don't allow any action if already punched in and out
    }

    if (!isPunchedIn) {
      if (isAfterTime(9, 30, now)) {
        setOpenReasonDialog(true);
        setReasonType("in");
      } else {
        await punchIn("");
        setOpenReasonDialog(false);
        setReasonType("");
      }
    }else {
      const confirmPunchOut = window.confirm(
        "Are you sure you want to punch out?"
      );
      if (!confirmPunchOut) return;
  
      // Show dialog if after 6:30 PM, otherwise punch out directly
      if (isAfterTime(18, 30, now)) {
        setOpenReasonDialog(true);
        setReasonType("out");
      } else {
        // Only update state after successful punch out
        const result = await punchOut("");
        if (result) {
          setPunchOutTime(now);
          setIsPunchedIn(false);
        }
      }
    }
  };

  const isAfterTime = (hour, minute, date) =>
    date.getHours() > hour ||
    (date.getHours() === hour && date.getMinutes() > minute);

  const formatReasonStatus = (reason, status) => {
    if (!reason || reason.trim() === "") {
      return "-";
    }
    return status;
  };

  return (
    <Box height="100%" p={3} sx={{ backgroundColor: theme.palette.grey[50] }}>
      {/* Main Header with Employee Attendance Title and Search/Filter */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
        sx={{
          backgroundColor: theme.palette.background.paper,
          p: 2,
          borderRadius: theme.shape.borderRadius,
          boxShadow: theme.shadows[1],
        }}
      >
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{ color: "#1b5e20", fontSize: "1.1rem", letterSpacing: "0.02em" }}
        >
          Employee Attendance Overview
        </Typography>
        <Box display="flex" gap={1}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: theme.palette.grey[500] }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: theme.shape.borderRadius * 1.5,
                "& fieldset": { borderColor: theme.palette.grey[300] },
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: theme.palette.common.white,
              },
            }}
          />
          <TextField
            variant="outlined"
            size="small"
            select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{
              borderRadius: theme.shape.borderRadius * 1.5,
              "& fieldset": { borderColor: theme.palette.grey[300] },
              "& .MuiOutlinedInput-root": {
                backgroundColor: theme.palette.common.white,
              },
            }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Present">Present</MenuItem>
            <MenuItem value="Leave">Leave</MenuItem>
          </TextField>
        </Box>
      </Box>

      {/* Attendance Card, Greeting, and Calendar */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="stretch"
        mt={2}
        gap={2}
      >
        <StyledPaper>
          <Box mb={2}>
            <Typography
              variant="subtitle2"
              color="textSecondary"
              sx={{ color: theme.palette.grey[600] }}
            >
              Attendance Tracker
            </Typography>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: theme.palette.text.primary }}
            >
              {formatTime(currentTime)}
            </Typography>
          </Box>
          <Box position="relative" width={144} height={144} mx="auto">
            <svg height="100%" width="100%">
              <circle
                stroke="#e0e0e0"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx="72"
                cy="72"
              />
              <circle
                stroke={"#1b5e20"}
                fill="transparent"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                r={normalizedRadius}
                cx="72"
                cy="72"
                transform="rotate(-90 72 72)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ color: theme.palette.grey[600] }}
              >
                {isPunchedIn ? "Today's" : "Total"} Hours
              </Typography>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ color: theme.palette.text.primary }}
              >
                {hoursToDisplay}
              </Typography>
            </Box>
          </Box>
          <Box
            my={2}
            display="flex"
            justifyContent="center"
            alignItems="center"
            gap={1}
          >
            {isPunchedIn && punchInTime ? (
              <>
                <FaFingerprint color={theme.palette.success.main} />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ color: theme.palette.grey[600] }}
                >
                  Punched In at {formatTime(punchInTime)}
                </Typography>
              </>
            ) : punchOutTime ? (
              <>
                <FaFingerprint color={theme.palette.error.main} />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ color: theme.palette.grey[600] }}
                >
                  Punched Out at {formatTime(punchOutTime)}
                </Typography>
              </>
            ) : (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ color: theme.palette.grey[600] }}
              >
                Status Placeholder
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            fullWidth
            onClick={handlePunch}
            disabled={
              (isPunchOutDisabled && isPunchedIn) ||
              isPunchingIn ||
              isPunchingOut
            }
            sx={{
              backgroundColor: isPunchedIn ? "#1b5e20" : "#1b5e20",
              color: "white",
              "&:hover": {
                backgroundColor: isPunchedIn ? "#1b5e20" : "#1b5e20",
              },
              fontWeight: 600,
              borderRadius: theme.shape.borderRadius * 1.5,
              py: 1.2,
            }}
          >
            {isPunchOutDisabled
              ? "Punched Out Today"
              : isPunchedIn
              ? "Punch Out"
              : "Punch In"}
          </Button>
        </StyledPaper>

        {/* "Hi, Good Afternoon [Name]!" with Hand Raise */}
        <Paper
          sx={{
            flexGrow: 1,
            p: 2,
            borderRadius: theme.shape.borderRadius * 2,
            boxShadow: theme.shadows[1],
            backgroundColor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "150px",
            textAlign: "center",
            gap: 1,
          }}
        >
          <Typography
            variant="h4"
            sx={{ animation: "wave 2.5s infinite", display: "inline-block" }}
          >
            👋
          </Typography>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{
              color: theme.palette.text.primary,
              fontSize: "1.25rem",
              letterSpacing: "0.02em",
            }}
          >
            {getGreeting()}, {userName || "User"}!
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {userProfile
              ? `Welcome back! Let's make today productive.`
              : "Loading your profile..."}
          </Typography>
        </Paper>

        {/* Calendar with Notes Feature */}
        <Box>
          <Paper
            sx={{
              p: 1,
              maxWidth: 300,
              borderRadius: theme.shape.borderRadius * 2,
              boxShadow: theme.shadows[1],
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.grey[300]}`,
            }}
          >
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <StaticDatePicker
                displayStaticWrapperAs="desktop"
                value={currentTime}
                onChange={(newValue) => {
                  if (newValue) {
                    handleDayClick(newValue); // Open note dialog on day click
                  }
                }}
                minDate={new Date(new Date().getFullYear() - 4, 0, 1)}
                // Years up to 2050
                maxDate={new Date(2050, 11, 31)}
                slotProps={{
                  actionBar: { actions: [] },
                  toolbar: {
                    toolbarFormat: "MMM dd",
                    sx: {
                      "& .MuiPickersCalendarHeader-label": {
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      },
                      minHeight: "40px",
                      padding: "0 8px",
                    },
                  },
                  day: {
                    sx: {
                      width: 32,
                      height: 32,
                      margin: "0 2px",
                      "&.Mui-selected": {
                        backgroundColor: "#1b5e20",
                        color: "#fff",
                        "&:hover": {
                          backgroundColor: "#1b5e20",
                        },
                      },
                    },
                  },
                }}
                sx={{
                  "& .MuiPickersCalendarHeader-root": {
                    margin: "4px 0",
                  },
                  "& .MuiPickersCalendarHeader-label": {
                    margin: "0 4px",
                  },
                  "& .MuiDayCalendar-weekDayLabel": {
                    width: 32,
                    margin: "0 2px",
                    fontSize: "0.75rem",
                    color: theme.palette.grey[600],
                  },
                  "& .MuiPickersSlideTransition-root": {
                    // Removed minHeight here to allow natural sizing and fix clipping
                  },
                }}
                renderDay={(day, _value, DayComponentProps) => {
                  const isToday =
                    day.toDateString() === new Date().toDateString();
                  const isWeekend = [0, 6].includes(day.getDay());
                  const dateKey = day.toISOString().slice(0, 10);
                  const hasNote = !!calendarNotes[dateKey];

                  return (
                    <Box
                      sx={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        display: "flex", // Use flex to center PickersDay
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onClick={() => handleDayClick(day)} // Handle click for note
                    >
                      <PickersDay
                        {...DayComponentProps}
                        disableMargin
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: "0.8rem",
                          fontWeight: isToday ? 700 : 400,
                          "&.Mui-selected": {
                            backgroundColor: isToday
                              ? "#1b5e20"
                              : "transparent",
                            color: isToday ? "#fff" : "inherit",
                            "&:hover": {
                              backgroundColor: isToday
                                ? "#1b5e20"
                                : "rgba(0, 0, 0, 0.04)",
                            },
                          },
                          backgroundColor: "transparent", // Ensure no default PickersDay background
                        }}
                      />
                      {isToday && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 4, // Adjust position as needed
                            right: 4, // Adjust position as needed
                            width: 6, // Larger dot for today
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: "#1b5e20",
                          }}
                        />
                      )}
                      {hasNote &&
                        !isToday && ( // Show note indicator only if not today (today has its own indicator)
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 1,
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              backgroundColor: theme.palette.info.main, // A distinct color for notes
                            }}
                          />
                        )}
                      {isWeekend &&
                        !isToday &&
                        !hasNote && ( // Show weekend indicator if no other special marker
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 1,
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 3,
                              height: 3,
                              borderRadius: "50%",
                              backgroundColor: theme.palette.grey[400],
                              opacity: 0.7,
                            }}
                          />
                        )}
                    </Box>
                  );
                }}
              />
            </LocalizationProvider>
          </Paper>
        </Box>
      </Box>

      {/* Buttons to trigger pop-ups */}
      <Box mt={1.5} display="flex" gap={2} justifyContent="center">
        <Button
          variant="contained"
          startIcon={<DescriptionOutlined />}
          onClick={() => setOpenDailyReportDialog(true)}
          sx={{
            py: 1,
            px: 2,
            borderRadius: theme.shape.borderRadius * 1.5,
            fontWeight: 600,
            backgroundColor: "#1b5e20",
            color: "white",
            border: `1px solid ${theme.palette.grey[300]}`,
            boxShadow: theme.shadows[1],
            "&:hover": {
              backgroundColor: "#1b5e20",
              color: "white",
              boxShadow: theme.shadows[2],
            },
            fontSize: "0.875rem",
          }}
        >
          Send Daily Report
        </Button>
        <Button
          variant="contained"
          startIcon={<ChatBubbleOutline />}
          onClick={async () => {
            try {
              const token = localStorage.getItem("access_token");
              // Get user id from localStorage or fetch from backend if not present
              let userId = localStorage.getItem("user_id");
              if (!userId) {
                // Fallback: fetch from backend
                const profileRes = await fetch(
                  "http://localhost:8000/api/auth/me/",
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                  }
                );
                if (profileRes.ok) {
                  const profileData = await profileRes.json();
                  userId = profileData.employee_id || profileData.id;
                  if (userId) localStorage.setItem("user_id", userId);
                }
              }
              const response = await fetch(
                `http://localhost:8000/api/attendance/admin-replies/${employeeId}/`,
                {
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                }
              );
              console.log("Fetching replies for userId:", userId);
              if (response.ok) {
                const data = await response.json();
                console.log("reply data", data);
                const latest =
                  Array.isArray(data) && data.length > 0
                    ? data[data.length - 1].admin_reply ||
                      JSON.stringify(data[data.length - 1])
                    : "No reply found.";
                setLatestReply(latest);
                console.log(latest);
              } else {
                setLatestReply("No reply found.");
              }
            } catch (e) {
              setLatestReply("Error fetching reply.");
            }
            setOpenReplyDialog(true);
          }}
          sx={{
            py: 1,
            px: 2,
            borderRadius: theme.shape.borderRadius * 1.5,
            fontWeight: 600,
            backgroundColor: "#1b5e20",
            color: "white",
            border: `1px solid ${theme.palette.grey[300]}`,
            boxShadow: theme.shadows[1],
            "&:hover": {
              backgroundColor: "#1b5e20",
              color: "white",
              boxShadow: theme.shadows[2],
            },
            fontSize: "0.875rem",
          }}
        >
          View Latest Reply
        </Button>
      </Box>

      {/* Late Punch-in/Punch-out Reason Dialog (Pop-up) */}
      <Dialog
        open={openReasonDialog}
        onClose={() => {
          setOpenReasonDialog(false);
          setReasonText("");
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          {reasonType === "in"
            ? "Reason for Late Punch In"
            : "Reason for Late Punch Out"}
          <IconButton
            onClick={() => {
              setOpenReasonDialog(false);
              setReasonText("");
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" mb={2}>
            {reasonType === "in"
              ? "Please provide a reason for punching in after 9:30 AM."
              : "Please provide a reason for punching out after 6:30 PM."}
          </Typography>
          <TextField
            multiline
            rows={6}
            placeholder="Enter your reason..."
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            fullWidth
            variant="outlined"
            sx={{ "& .MuiOutlinedInput-root": { py: 1.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setOpenReasonDialog(false);
              setReasonText("");
            }}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (reasonType === "in") {
                punchIn(reasonText);
                setOpenReasonDialog(false);
                setReasonText("");
              } else {
                punchOut(reasonText);
                setOpenReasonDialog(false);
                setReasonText("");
              }
            }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Daily Report Dialog (Pop-up) - Lighter Orange Scheme */}
      <Dialog
        open={openDailyReportDialog}
        onClose={() => {
          setOpenDailyReportDialog(false);
          setDailyReportMessage("");
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
            backgroundColor: "#1b5e20",
            color: "white",
            py: 2,
            px: 3,
            borderTopLeftRadius: theme.shape.borderRadius * 2,
            borderTopRightRadius: theme.shape.borderRadius * 2,
          }}
        >
          Send Daily Report
          <IconButton
            onClick={() => {
              setOpenDailyReportDialog(false);
              setDailyReportMessage("");
            }}
            sx={{ color: theme.palette.common.white }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            label="To"
            fullWidth
            value="venkateswararao.garikapati@innovatorstech.com"
            sx={{ mb: 2 }}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Message"
            fullWidth
            multiline
            rows={8}
            value={dailyReportMessage}
            onChange={(e) => setDailyReportMessage(e.target.value)}
            placeholder={`Enter your daily report here...`}
            sx={{ "& .MuiOutlinedInput-root": { py: 1.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setOpenDailyReportDialog(false);
              setDailyReportMessage("");
            }}
            color="secondary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => sendDailyReport(dailyReportMessage)}
            sx={{
              backgroundColor: mediumOrange,
              "&:hover": { backgroundColor: "#1b5e20" },
              fontWeight: 600,
              color: "white",
            }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reply Dialog (Pop-up) - White Scheme */}
      <Dialog
        open={openReplyDialog}
        onClose={() => setOpenReplyDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
            backgroundColor: "#1b5e20",
            color: "white",
            borderBottom: `1px solid ${theme.palette.divider}`,
            py: 2,
            px: 3,
            borderTopLeftRadius: theme.shape.borderRadius * 2,
            borderTopRightRadius: theme.shape.borderRadius * 2,
          }}
        >
          Reply from Manager
          <IconButton onClick={() => setOpenReplyDialog(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ color: theme.palette.text.secondary }}>
            "{latestReply}"
          </Typography>
          <Box mt={2}>
            <Typography variant="caption" display="block" color="text.disabled">
              Received:{" "}
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              at{" "}
              {new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setOpenReplyDialog(false)}
            variant="contained"
            sx={{
              backgroundColor: "#1b5e20",
              "&:hover": { backgroundColor: "#1b5e20" },
              fontWeight: 600,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Calendar Note Dialog */}
      <Dialog
        open={openNoteDialog}
        onClose={handleCloseNoteDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          Note for{" "}
          {selectedDateForNote
            ? selectedDateForNote.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : ""}
          <IconButton onClick={handleCloseNoteDialog}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            multiline
            rows={6}
            placeholder="Add or edit your note here..."
            value={noteDialogText}
            onChange={(e) => setNoteDialogText(e.target.value)}
            fullWidth
            variant="outlined"
            sx={{ "& .MuiOutlinedInput-root": { py: 1.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseNoteDialog} color="secondary">
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleSaveNote}>
            Save Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recent Attendance Table */}
      <Box mt={1.5}>
        <Typography
          variant="h6"
          mb={1}
          sx={{
            color: theme.palette.text.primary,
            fontWeight: "bold",
            fontSize: "1.1rem",
            letterSpacing: "0.02em",
          }}
        >
          Recent Attendance History
        </Typography>

        <Paper
          sx={{
            borderRadius: "8px",
            boxShadow: theme.shadows[1],
            overflow: "hidden",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: "#1b5e20",
                  "& th": {
                    color: theme.palette.common.white,
                    fontWeight: "bold",
                    py: 1.5,
                  },
                }}
              >
                <TableCell>Date</TableCell>
                <TableCell>Punch In</TableCell>
                <TableCell>Punch Out</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Punch In Reason</TableCell>
                <TableCell>Punch In Status</TableCell>
                <TableCell>Punch Out Reason</TableCell>
                <TableCell>Punch Out Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : attendanceRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No attendance records found
                  </TableCell>
                </TableRow>
              ) : (
                formattedAttendanceRecords.map((row, index) => (
                  <TableRow
                    key={row.id}
                    sx={{
                      "&:nth-of-type(odd)": {
                        backgroundColor: theme.palette.grey[50],
                      },
                      "&:nth-of-type(even)": {
                        backgroundColor: theme.palette.common.white,
                      },
                      "&:hover": {
                        backgroundColor: theme.palette.primary.light + "10",
                        cursor: "pointer",
                      },
                      "& td": {
                        py: 1.5,
                        color: theme.palette.text.secondary,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      },
                      "&:last-child td": {
                        borderBottom: "none",
                      },
                    }}
                  >
                    <TableCell>{row.dateDisplay}</TableCell>
                    <TableCell>{formatTime(row.punch_in)}</TableCell>
                    <TableCell>{formatTime(row.punch_out)}</TableCell>
                    <TableCell>{row.hoursDisplay}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        size="small"
                        sx={{
                          backgroundColor:
                            row.status === "Present"
                              ? theme.palette.success.light
                              : theme.palette.error.light,
                          color:
                            row.status === "Present"
                              ? theme.palette.success.dark
                              : "#1b5e20",
                          fontWeight: "bold",
                          borderRadius: "4px",
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.punch_in_reason}</TableCell>
                    <TableCell>
                      {formatReasonStatus(
                        row.punch_in_reason,
                        row.punch_in_reason_status
                      )}
                    </TableCell>
                    <TableCell>{row.punch_out_reason}</TableCell>
                    <TableCell>
                      {formatReasonStatus(
                        row.punch_out_reason,
                        row.punch_out_reason_status
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
};

export default AttendanceCard;
