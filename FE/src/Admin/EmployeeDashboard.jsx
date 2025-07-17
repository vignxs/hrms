import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  InputAdornment,
  ClickAwayListener,
  Fade,
  Menu,
  Collapse,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ShareIcon from "@mui/icons-material/Share";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { useNavigate } from "react-router-dom";
import GroupIcon from "@mui/icons-material/Group";
import FilterListIcon from "@mui/icons-material/FilterList";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

function EmployeeDashboard() {
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState([]);
  const [lastLoginReasons, setLastLoginReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [selectedReportContent, setSelectedReportContent] = useState("");

  const [selectedPunchInReason, setSelectedPunchInReason] = useState("");
  const [selectedPunchOutReason, setSelectedPunchOutReason] = useState("");

  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [lateLoginReasons, setLateLoginReasons] = useState([]);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [selectedReasonType, setSelectedReasonType] = useState(null);
  const [shareAnchorEl, setShareAnchorEl] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const currentUserEmail = localStorage.getItem("user_email");
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Transform data into a consistent format
  const transformedData = React.useMemo(() => {
    if (!employeeData || !Array.isArray(employeeData)) return [];

    return employeeData.map((emp) => {
      if (!emp || typeof emp !== "object") return null;
      
      // Determine status based on punch-in/out times
      let displayStatus = "No Attendance";
      if (emp.punch_in_time) {
        displayStatus = emp.punch_out_time ? "Offline" : "Online";
      }

      return {
        a_id:emp.a_id,
        id: emp.id,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email || '',
        punch_in: emp.punch_in_time || '',
        punch_out: emp.punch_out_time || '',
        hours_worked: emp.hours_worked || '0h 0m',
        report_status: emp.report_status || "Not Submitted",
        report_details: emp.report_details || "No details",
        has_report: emp.dailyReportSent ? true : false,
        dailyReportSent: emp.dailyReportSent,
        punch_in_reason: emp.punch_in_reason || "",
        punch_out_reason: emp.punch_out_reason || "",
        punch_in_reason_status: emp.punch_in_reason_status || "pending",
        punch_out_reason_status: emp.punch_out_reason_status || "pending",
        
        status: displayStatus,
      };
    }).filter(Boolean); // Remove null entries
  }, [employeeData]);

  // Filter data based on search term and status
  const filteredData = React.useMemo(() => {
    if (!transformedData || !Array.isArray(transformedData)) return [];

    return transformedData.filter((emp) => {
      // Skip if employee data is invalid
      if (!emp || typeof emp !== "object") return false;

      // Filter by search term
      const searchTermLower = searchTerm?.toLowerCase() || '';
      const matchesSearch =
        !searchTerm ||
        emp.name.toLowerCase().includes(searchTermLower) ||
        emp.email.toLowerCase().includes(searchTermLower) ||
        emp.status.toLowerCase().includes(searchTermLower) ||
        emp.punch_in_reason.toLowerCase().includes(searchTermLower) ||
        emp.punch_out_reason.toLowerCase().includes(searchTermLower);

      // Filter by status
      const matchesStatus =
        filterStatus === "All" ||
        emp.status.toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [transformedData, searchTerm, filterStatus]);

  // Define columns for the DataGrid
  const EmployeeColumn = [
    {
      field: "name",
      headerName: "Employee Name",
      flex: 1,
      minWidth: 200,
      headerAlign: "left",
      align: "left",
      renderCell: (params) => {
        const { name } = params.row;
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2">
              {name || ""}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "email",
      headerName: "Email",
      width: 250,
      headerAlign: "left",
      align: "left",
    },
    {
      field: "punch_in",
      headerName: "Login",
      width: 170,
      headerAlign: "left",
      align: "left",
    },
    {
      field: "punch_out",
      headerName: "Logout",
      width: 170,
      headerAlign: "left",
      align: "left",
    },
    {
      field: "hours_worked",
      headerName: "Hours",
      width: 100,
      headerAlign: "left",
      align: "left",
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography>{params.value || "0h 0m"}</Typography>
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      headerAlign: "left",
      align: "left",
      renderCell: (params) => {
        // Get punch-in/out times from row data
        const { punch_in, punch_out } = params.row;

        // Determine status based on punch-in/out times
        const isOnline = punch_in && !punch_out;

        return (
          <Chip
            label={isOnline ? "Online" : "Offline"}
            color={isOnline ? "success" : "error"}
            size="small"
          />
        );
      },
    },
    {
      field: "report_status",
      headerName: "Daily Report",
      width: 160,
      headerAlign: "left",
      align: "left",
      renderCell: (params) => {
        const hasReport = params.row.has_report;
        
        // console.log("hasReport", hasReport);
        // console.log("params", params.row.name);
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center", // vertical alignment
              height: "100%", // make it fill cell height
              cursor: hasReport ? "pointer" : "default",
              color: hasReport ? "primary.main" : "text.secondary",
            }}
            onClick={() => {
              if (hasReport) handleReportClick(params.row);
            }}
          >
            {hasReport ? (
              <CheckCircleIcon sx={{ color: "success.main", mr: 1 }} />
            ) : (
              <CancelIcon sx={{ color: "error.main", mr: 1 }} />
            )}
            <Typography
              sx={{
                textDecoration: hasReport ? "underline" : "none",
              }}
            >
              {hasReport ? "Sent" : "Not Submitted"}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "punch_in_reason",
      headerName: "Reason",
      width: 200,
      headerAlign: "left",
      align: "left",
      renderCell: (params) => {
        const reason = params.row.punch_in_reason || params.row.punch_out_reason || null;

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center", // vertically center
              height: "100%", // fill full cell height
              gap: 1,
            }}
          >
            {reason ? (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={() => {
                  setSelectedReasonId(params.row.a_id);
                  setSelectedReason(reason);
                  setSelectedName(
                params.row.name
                  );
                  setReasonDialogOpen(true);
                  setSelectedPunchInReason(params.row.punch_in_reason);
                  setSelectedPunchOutReason(params.row.punch_out_reason);
                  // Set reason type based on which reason exists
                  if (params.row.punch_in_reason) {
                    setSelectedReasonType("punch_in");
                  } else if (params.row.punch_out_reason) {
                    setSelectedReasonType("punch_out");
                  }
                }}
              >
                View
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No reason provided
              </Typography>
            )}
          </Box>
        );
      },
    },
  ];

  const fetchAttendanceData = async () => {
    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `http://localhost:8000/api/admin/attendance/history/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `application/json`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance data");
      }

      const data = await response.json();
      console.log("Attendance data sample:", data.items.length);

      // The backend returns data in items array
      setEmployeeData(data.items);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching employee data:", error);
      setLoading(false);
      setError("Failed to fetch employee data");
    }
  };

  console.log("length of employeeData", employeeData.length);
  // console.log("employeeData", employeeData);

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchLastLoginReasons = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `http://localhost:8000/api/admin/attendance/late-login-reasons/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `application/json`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance data");
      }

      const data = await response.json();
      console.log("Late Login Reasons data sample:", data);
      console.log("Late Login Reasons data sample:", data?.items?.[0]);

      // The backend returns data in items array
      setLateLoginReasons(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching late login reasons data:", error);
      setLoading(false);
      setError("Failed to fetch late login reasons data");
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    fetchLastLoginReasons();

    const interval = setInterval(() => {
      fetchAttendanceData();
      fetchLastLoginReasons();

    }, 10000); // 10,000 ms = 10 seconds
    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  const handleReportClick = (row) => {
    console.log("Clicked row data:", row);

    // Access report data
    const reportData = row?.dailyReportSent?.work_details;
    console.log("Report data:", reportData);

    // Get the work details
    const workDetails = reportData || "No report submitted";
    console.log("Work details:", workDetails);
    setSelectedReportId(row.dailyReportSent?.report_id);
    setSelectedReportContent(workDetails);
    setSelectedEmail(row?.email || "");
    setSelectedName(row?.first_name || "");
    setReplyMode(false);
    setReplyText("");
    setOpenDialog(true);

    // Debug full row
    console.log("Full row data:", {
      email: row?.email,
      name: row?.first_name,
      report: row?.dailyReportSent,
      report_id: row?.dailyReportSent?.report_id,
    });
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/employees/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_email");
      navigate("/");
    }
  };

  const handleShareClick = (event) => {
    setShareAnchorEl(event.currentTarget);
  };

  const handleShareClose = () => {
    setShareAnchorEl(null);
  };

  const handleSendReply = async () => {
   console.log("Selected report ID:", selectedReportId);
   console.log("Reply text:", replyText);
    if (!selectedReportId || !replyText.trim()) return;
  
    try {
      const token = localStorage.getItem("access_token");
  
      const res = await fetch(
        `http://localhost:8000/api/admin/reports/${selectedReportId}/reply/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: replyText.trim(),
          }),
        }
      );
  
      if (!res.ok) {
        const err = await res.json();
        console.error("Reply failed:", err);
        alert(err.error || "Failed to send reply");
        return;
      }
  
      const data = await res.json();
      console.log("Reply success:", data);
  
      setReplyMode(false);
      setReplyText("");
      setOpenDialog(false);
  
      // TODO: Optionally trigger data refresh or toast
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error while sending reply");
    }
  };
  

  const handleExport = (format) => {
    handleShareClose();

    // Prepare data for export
    const exportData = filteredData.map((emp) => ({
      Name: `${emp.first_name} ${emp.last_name}` || "-",
      Email: emp.email || "-",
      Department: emp.department || "N/A",
      Position: emp.position || "N/A",
      Status: emp.status || "No Attendance",
      Login:
        emp.punch_in_time && emp.punch_in_time !== "-"
          ? new Date(emp.punch_in_time).toLocaleString()
          : "-",
      Logout:
        emp.punch_out_time && emp.punch_out_time !== "-"
          ? new Date(emp.punch_out_time).toLocaleString()
          : "-",
      "Hours Worked": emp.hours_worked || "0h 0m",
      "Daily Report": emp.report_status || "Not Submitted",
      "Report Details": emp.report_details || "No details",
      "Has Report": emp.has_report ? "Yes" : "No",
      "Last Updated": new Date().toLocaleString(),
    }));

    if (format === "excel" || format === "csv") {
      try {
        // Check if XLSX is available
        if (typeof XLSX === "undefined") {
          console.error("XLSX library is not available");
          return;
        }

        const ws = XLSX.utils.json_to_sheet(exportData);

        if (format === "excel") {
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Employee Data");
          XLSX.writeFile(
            wb,
            `Employee_Data_${new Date().toISOString().split("T")[0]}.xlsx`
          );
        } else {
          // CSV
          const csv = XLSX.utils.sheet_to_csv(ws);
          // Add UTF-8 BOM for Excel compatibility
          const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;",
          });
          saveAs(
            blob,
            `Employee_Data_${new Date().toISOString().split("T")[0]}.csv`
          );
        }
      } catch (error) {
        console.error(`Error exporting to ${format.toUpperCase()}:`, error);
        alert(
          `Failed to export data to ${format.toUpperCase()}. Please try again.`
        );
      }
    } else if (format === "word") {
      try {
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  text: "Employee Attendance Report",
                  heading: "Heading1",
                  spacing: { after: 200 },
                }),
                new Paragraph({
                  text: `Generated on: ${new Date().toLocaleString()}`,
                  spacing: { after: 400 },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    // Header row
                    new TableRow({
                      children: Object.keys(exportData[0] || {}).map(
                        (header) =>
                          new TableCell({
                            children: [
                              new Paragraph({
                                text: header,
                                bold: true,
                              }),
                            ],
                          })
                      ),
                    }),
                    // Data rows
                    ...exportData.map(
                      (emp) =>
                        new TableRow({
                          children: Object.values(emp).map(
                            (value) =>
                              new TableCell({
                                children: [
                                  new Paragraph({
                                    text: String(value),
                                    spacing: { line: 300 },
                                  }),
                                ],
                              })
                          ),
                        })
                    ),
                  ],
                }),
              ],
            },
          ],
        });

        // Generate and download the Word document
        Packer.toBlob(doc).then((blob) => {
          saveAs(
            blob,
            `Employee_Report_${new Date().toISOString().split("T")[0]}.docx`
          );
        });
      } catch (error) {
        console.error("Error exporting to Word:", error);
        alert("Failed to export data to Word. Please try again.");
      }
    }
  };

  const handlePunchinPunchoutReasonApproval = async (approvalStatus, reasonType) => {
    try {
      const token = localStorage.getItem("access_token");
      
      const url = `http://localhost:8000/api/attendance/approve-reason/${selectedReasonId}/`;

      const payload = {
        status: approvalStatus, // "approved" or "rejected"
        reason_type: reasonType, // "punch_in" or "punch_out"
        admin_comment: replyText.trim() || null, // Optional admin comment
      };

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update ${reasonType} reason status`);
      }

      await fetchLastLoginReasons();
      
      // Reset state
      setReasonDialogOpen(false);
      setSelectedReasonId(null);
      setSelectedReason(null);
      setSelectedReasonType(null);
      setSelectedName(null);
      setSelectedPunchInReason(null);
      setSelectedPunchOutReason(null);
      setReplyText("");
    } catch (error) {
      console.error("Reason approval failed:", error);
      setError(error.message || "Something went wrong");
    }
  };

  const handleSearchClick = () => {
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  const getStatusColor = (status) => {
    if (!status) return "default";
    const statusLower = status.toLowerCase();

    if (statusLower.includes("active") || statusLower.includes("online")) {
      return "success";
    } else if (
      statusLower.includes("inactive") ||
      statusLower.includes("offline")
    ) {
      return "error";
    } else if (statusLower.includes("leave") || statusLower.includes("away")) {
      return "warning";
    } else if (statusLower.includes("break") || statusLower.includes("lunch")) {
      return "info";
    }
    return "default";
  };

  const calculateHours = (login, logout) => {
    // Handle invalid or missing inputs
    if (!login || !logout || login === "-" || logout === "-") return "-";

    try {
      // Parse dates
      const loginTime = new Date(login);
      const logoutTime = new Date(logout);

      // Validate dates
      if (isNaN(loginTime.getTime()) || isNaN(logoutTime.getTime())) {
        console.warn("Invalid date format in calculateHours");
        return "-";
      }

      // Calculate difference in milliseconds
      const diffMs = logoutTime - loginTime;

      // Handle invalid time difference (negative or invalid)
      if (isNaN(diffMs) || diffMs < 0) return "-";

      // Calculate hours and minutes
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      // Format the output
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    } catch (error) {
      console.error("Error in calculateHours:", error);
      return "-";
    }
  };

  
  if (loading)
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: 0 }}>
      <Box display="flex" alignItems="center" mb={2} gap={2} flexWrap="wrap">
        <Typography variant="h4" fontWeight="bold" flexGrow={1}>
          Employee Status
        </Typography>

        <ClickAwayListener
          onClickAway={() => {
            if (!searchTerm) setIsSearchOpen(false);
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", position: "relative" }}
          >
            {!isSearchOpen ? (
              <IconButton onClick={handleSearchClick}>
                <SearchIcon />
              </IconButton>
            ) : (
              <Fade in={isSearchOpen}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <TextField
                    variant="standard"
                    size="small"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter by name"
                    autoFocus
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: null,
                    }}
                    sx={{
                      width: 200,
                      "& .MuiInputBase-root": {
                        padding: "6px 0",
                      },
                      "& .MuiInputBase-input": {
                        padding: "6px 0",
                      },
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "2px",
                      background: "linear-gradient(90deg, #FFA500, #FF8C00)",
                      borderRadius: "2px",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={handleCloseSearch}
                    sx={{
                      ml: 1,
                      color: "text.secondary",
                      "&:hover": {
                        color: "error.main",
                        backgroundColor: "rgba(244, 67, 54, 0.08)",
                      },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Fade>
            )}
          </Box>
        </ClickAwayListener>

        <Box
          sx={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            ml: 1,
          }}
        >
          <FilterListIcon
            sx={{ color: "text.secondary", mr: 0.5, fontSize: 20 }}
          />
          <Button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            endIcon={showStatusDropdown ? <ExpandLess /> : <ExpandMore />}
            startIcon={<GroupIcon fontSize="small" />}
            sx={{
              minWidth: 60,
              justifyContent: "space-between",
              textTransform: "none",
              borderColor: "divider",
              backgroundColor: "background.paper",
              "&:hover": {
                borderColor: "text.primary",
                backgroundColor: "action.hover",
              },
              pl: 1,
              pr: 0.5,
            }}
          >
            Status
          </Button>

          {showStatusDropdown && (
            <ClickAwayListener onClickAway={() => setShowStatusDropdown(false)}>
              <Paper
                elevation={3}
                sx={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 1,
                  mt: 0.5,
                  minWidth: 150,
                  borderRadius: 1,
                  overflow: "hidden",
                  animation: "fadeIn 0.2s ease-out",
                  "@keyframes fadeIn": {
                    "0%": { opacity: 0, transform: "translateY(-10px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                {[
                  {
                    value: "All",
                    label: "All",
                    icon: <GroupIcon fontSize="small" />,
                  },
                  {
                    value: "Online",
                    label: "Online",
                    icon: (
                      <FiberManualRecordIcon fontSize="small" color="success" />
                    ),
                  },
                  {
                    value: "Offline",
                    label: "Offline",
                    icon: (
                      <FiberManualRecordIcon
                        fontSize="small"
                        color="disabled"
                      />
                    ),
                  },
                ].map(({ value, label, icon }) => (
                  <MenuItem
                    key={value}
                    selected={filterStatus === value}
                    onClick={() => {
                      setFilterStatus(value);
                      setShowStatusDropdown(false);
                    }}
                    sx={{
                      "&.Mui-selected": {
                        backgroundColor: "primary.light",
                        "&:hover": {
                          backgroundColor: "primary.light",
                        },
                      },
                      "&:hover": {
                        backgroundColor: "action.hover",
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {icon}
                      {label}
                    </Box>
                  </MenuItem>
                ))}
              </Paper>
            </ClickAwayListener>
          )}
        </Box>

        <Box
          sx={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            ml: 1,
          }}
        >
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShareOpen(!shareOpen);
            }}
            startIcon={<ShareIcon />}
            sx={{
              color: "primary.main",
              textTransform: "none",
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
            aria-label="export options"
          >
            Export
          </Button>

          {shareOpen && (
            <ClickAwayListener onClickAway={() => setShareOpen(false)}>
              <Paper
                elevation={3}
                sx={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  zIndex: 1,
                  mt: 0.5,
                  borderRadius: 1,
                  overflow: "hidden",
                  minWidth: 150,
                  animation: "fadeIn 0.2s ease-out",
                  "@keyframes fadeIn": {
                    "0%": { opacity: 0, transform: "translateY(-10px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport("word");
                    setShareOpen(false);
                  }}
                  sx={{
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  Export to Word
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport("csv");
                    setShareOpen(false);
                  }}
                  sx={{
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  Export to CSV
                </MenuItem>
              </Paper>
            </ClickAwayListener>
          )}
        </Box>

        <ClickAwayListener onClickAway={() => setShareOpen(false)}>
          <Box sx={{ display: "none" }} />
        </ClickAwayListener>
      </Box>

      <Paper
        elevation={3}
        sx={{
          width: "100%",
          mb: 4,
          p: 3,
          backgroundColor: "background.paper",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            padding: 1,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              color: "text.primary",
              fontSize: "1.1rem",
            }}
          >
            Employee Status
          </Typography>
        </Box>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="500px"
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100px"
            color="error.main"
          >
            {error}
          </Box>
        ) : transformedData.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="500px"
            p={4}
          >
            <Typography variant="h6" color="text.secondary">
              No employee data available
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              height: "400px",
              width: "100%",
              overflow: "auto",
            }}
          >
            <DataGrid
              rows={filteredData}
              columns={EmployeeColumn}
              disableSelectionOnClick
              getRowId={(row) => row.id}
              loading={loading}
              hideFooterPagination={true}
              hideFooterSelectedRowCount={true}
              disableColumnMenu
              sx={{
                "& .MuiDataGrid-root": {
                  width: "100%",
                  "& .MuiDataGrid-virtualScroller": {
                    overflowY: "auto",
                  },
                },
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Late Login Reasons Table */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: "bold",
          mt: 6,
          mb: 2,
          color: "text.primary",
          fontSize: "1.1rem",
          paddingLeft: 1,
        }}
      >
        Late Login Reasons
      </Typography>
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          mb: 4,
          p: 3,
          backgroundColor: "background.paper",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {loading && lateLoginReasons.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="400px"
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              height: "400px",
              width: "100%",
              overflow: "auto",
            }}
          >
            <DataGrid
              rows={lateLoginReasons.map((r) => {
                return {
                  id: r.id,
                  name: r.name,
                  reason: r.reason,
                  login_time: r.login_time,
                  action: r.action,
                  email: r.email,
                  punch_in_time: r.punch_in_time,
                  punch_out_time: r.punch_out_time,
                  punch_in_reason_status: r.punch_in_reason_status,
                  punch_out_reason_status: r.punch_out_reason_status,
                  punch_in_reason: r.punch_in_reason,
                  punch_out_reason: r.punch_out_reason,
                  hours: r.hours,
                };
              })}
              components={{
                NoRowsOverlay: () => (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height="400px"
                  >
                    <Typography color="textSecondary">
                      No late login reasons found
                    </Typography>
                  </Box>
                ),
                LoadingOverlay: () => (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height="400px"
                  >
                    <CircularProgress />
                  </Box>
                ),
                NoResultsOverlay: () => (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height="400px"
                  >
                    <Typography>No matching records found</Typography>
                  </Box>
                ),
              }}
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "background.default",
                  borderBottom: "2px solid",
                  borderColor: "divider",
                  "& .MuiDataGrid-columnHeaderTitle": {
                    fontWeight: "bold",
                    color: "text.primary",
                  },
                },
                "& .MuiDataGrid-cell": {
                  padding: "12px 16px",
                  borderColor: "divider",
                  "&:focus, &:focus-within": {
                    outline: "none",
                  },
                },
                "& .MuiDataGrid-row": {
                  "&:nth-of-type(odd)": {
                    backgroundColor: "background.default",
                  },
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                  "&.Mui-selected": {
                    backgroundColor: "action.selected",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  },
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "1px solid",
                  borderColor: "divider",
                  mt: 1,
                },
                "& .MuiDataGrid-virtualScroller": {
                  minHeight: "300px",
                },
                "& .MuiDataGrid-overlay": {
                  height: "300px",
                  backgroundColor: "background.default",
                },
                "& .MuiDataGrid-columnHeader, & .MuiDataGrid-cell": {
                  "&:not(:last-child)": {
                    borderRight: "1px solid",
                    borderColor: "divider",
                  },
                },
                "& .MuiDataGrid-columnSeparator": {
                  display: "none",
                },
              }}
              const columns = {[
                {
                  field: "name",
                  headerName: "Employee",
                  width: 200,
                  headerAlign: "left",
                  align: "left",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                      <Typography variant="body2">{params.row.name}</Typography>
                    </Box>
                  ),
                },
                {
                  field: "email",
                  headerName: "Email",
                  width: 220,
                  headerAlign: "left",
                  align: "left",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                      <Typography variant="body2">{params.row.email}</Typography>
                    </Box>
                  ),
                },
                {
                  field: "hours",
                  headerName: "Hours",
                  width: 100,
                  headerAlign: "center",
                  align: "center",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                      <Typography variant="body2">{params.row.hours}</Typography>
                    </Box>
                  ),
                },
                {
                  field: "punch_in_time",
                  headerName: "Punch-in Time",
                  width: 140,
                  headerAlign: "center",
                  align: "center",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                      <Typography variant="body2">{params.row.punch_in_time || "--"}</Typography>
                    </Box>
                  ),
                },
                {
                  field: "punch_in_reason",
                  headerName: "Punch-in Reason",
                  width: 220,
                  headerAlign: "left",
                  align: "left",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                      <Typography variant="body2">
                        {params.row.punch_in_reason || "—"}
                      </Typography>
                    </Box>
                  ),
                },
                {
                  field: "punch_in_status",
                  headerName: "Punch-in Status",
                  width: 160,
                  headerAlign: "center",
                  align: "center",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                      <Chip
                        label={params.row.punch_in_reason_status}
                        color={
                          params.row.punch_in_reason_status === "approved"
                            ? "success"
                            : params.row.punch_in_reason_status === "rejected"
                            ? "error"
                            : "warning"
                        }
                        size="small"
                      />
                    </Box>
                  ),
                },
                {
                  field: "punch_out_time",
                  headerName: "Punch-out Time",
                  width: 140,
                  headerAlign: "center",
                  align: "center",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                      <Typography variant="body2">{params.row.punch_out_time || "--"}</Typography>
                    </Box>
                  ),
                },
                {
                  field: "punch_out_reason",
                  headerName: "Punch-out Reason",
                  width: 220,
                  headerAlign: "left",
                  align: "left",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                      <Typography variant="body2">
                        {params.row.punch_out_reason || "—"}
                      </Typography>
                    </Box>
                  ),
                },
                {
                  field: "punch_out_status",
                  headerName: "Punch-out Status",
                  width: 160,
                  headerAlign: "center",
                  align: "center",
                  renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                      <Chip
                        label={params.row.punch_out_reason_status}
                        color={
                          params.row.punch_out_reason_status === "approved"
                            ? "success"
                            : params.row.punch_out_reason_status === "rejected"
                            ? "error"
                            : "warning"
                        }
                        size="small"
                      />
                    </Box>
                  ),
                },
              ]}

              




              
                            
              hideFooterPagination={true}
              hideFooterSelectedRowCount={true}
              disableColumnMenu
              disableSelectionOnClick
            />
          </Box>
        )}
      </Paper>

      {/* Daily Report Dialog with Reply */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Email Report</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: "pre-line" }}>
            <b>To:</b> {selectedEmail}
            {"\n"}
            <b>Subject:</b> Daily Report
            {"\n\n"}Hello,
            {"\n"}Please find attached your daily attendance and task summary.
            {"\n\n"}Report Content:
            {"\n"}
            {selectedReportContent || "-"}
            {"\n\n"}Regards,
            {"\n"}Admin Team
          </DialogContentText>

          {!replyMode ? (
            <Box mt={2}>
              <Button variant="outlined" onClick={() => setReplyMode(true)}>
                Reply
              </Button>
            </Box>
          ) : (
            <Box mt={2}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Type your reply"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <Box mt={2} display="flex" gap={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSendReply}
                >
                  Send
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setReplyMode(false);
                    setReplyText("");
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          {!replyMode && (
            <Button onClick={() => setOpenDialog(false)}>Close</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reason Dialog */}
      <Dialog
        open={reasonDialogOpen}
        onClose={() => {
          setReasonDialogOpen(false);
          setSelectedReasonId(null);
          setSelectedReason(null);
          setSelectedReasonType(null);
          setSelectedName(null);
          setSelectedPunchInReason(null);
          setSelectedPunchOutReason(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reason Details</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              {selectedName}
            </Typography>

            {/* Punch-in reason section */}
            <Box
              sx={{ mb: 2, border: "1px solid #e0e0e0", p: 2, borderRadius: 1 }}
            >
              <Typography
                variant="subtitle2"
                color="textSecondary"
                sx={{ mb: 1 }}
              >
                Punch-in Reason
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedPunchInReason || "No punch-in reason provided"}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!selectedPunchInReason}
                  onClick={() => handlePunchinPunchoutReasonApproval("approved", "punch_in")}
                >
                  Approve Punch-in
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  disabled={!selectedPunchInReason}
                  onClick={() => handlePunchinPunchoutReasonApproval("rejected", "punch_in")}
                >
                  Reject Punch-in
                </Button>
              </Box>
            </Box>

            {/* Punch-out reason section */}
            <Box
              sx={{ mb: 2, border: "1px solid #e0e0e0", p: 2, borderRadius: 1 }}
            >
              <Typography
                variant="subtitle2"
                color="textSecondary"
                sx={{ mb: 1 }}
              >
                Punch-out Reason
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedPunchOutReason || "No punch-out reason provided"}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!selectedPunchOutReason}
                  onClick={() => handlePunchinPunchoutReasonApproval("approved", "punch_out")}
                >
                  Approve Punch-out
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  disabled={!selectedPunchOutReason}
                  onClick={() => handlePunchinPunchoutReasonApproval("rejected", "punch_out")}
                >
                  Reject Punch-out
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setReasonDialogOpen(false);
              setSelectedReasonId(null);
              setSelectedReason(null);
              setSelectedReasonType(null);
              setSelectedName(null);
              setSelectedPunchInReason(null);
              setSelectedPunchOutReason(null);
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EmployeeDashboard;
