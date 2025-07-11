import {
    Box,
    Button,
    Paper,
    TextField,
    Typography,
    Stack,
    Alert,
    Grid,
    InputAdornment,
} from "@mui/material";
import { LockOutlined } from '@mui/icons-material';
import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
 
export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useParams();
    const { resetPassword } = useAuth();
 
    // If you still want to support ?email=... as fallback:
    const searchParams = new URLSearchParams(location.search);
    const email = searchParams.get('email');
 
    const animatedBackground = {
        background: "linear-gradient(-45deg, #2193b0, #6dd5ed, #b92b27, #1565C0)",
        backgroundSize: "400% 400%",
        animation: "gradientAnimation 15s ease infinite",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        '&': {
            '@keyframes gradientAnimation': {
                '0%': { backgroundPosition: '0% 50%' },
                '50%': { backgroundPosition: '100% 50%' },
                '100%': { backgroundPosition: '0% 50%' },
            },
        },
    };
 
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");
 
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
 
        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }
 
        // Use token from path or email from query
        if (!token && !email) {
            setError("Invalid reset link: missing token or email parameter");
            return;
        }
 
        try {
            // Pass token or email to resetPassword
            await resetPassword(token || email, password);
            setSuccessMsg("Password has been successfully reset.");
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            setError(err.message || "Failed to reset password. Please try again.");
        }
    };
 
    const handleBackToLogin = () => {
        navigate("/login");
    };
 
    return (
        <Grid container component="main" sx={{
            ...animatedBackground,
        }}>
            <Paper
                elevation={4}
                sx={{
                    p: 3,
                    width: "100%",
                    maxWidth: 360,
                    borderRadius: "32px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                    backgroundColor: "#fff",
                }}
            >
                <Box display="flex" justifyContent="center" mb={2}>
                    <img
                        src="https://innovatorstech.com/wp-content/uploads/2024/06/Innovators-Tech-Black.svg"
                        alt="Innovators Tech Logo"
                        style={{ height: 40 }}
                    />
                </Box>
 
                <Typography
                    fontWeight="bold"
                    align="center"
                    mb={1}
                    lineHeight={1.3}
                >
                    Reset Password
                </Typography>
 
                {/* Debug: Show email param if present */}
                {email && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Resetting password for: <b>{email}</b>
                    </Alert>
                )}
 
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
 
                {successMsg && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {successMsg}
                    </Alert>
                )}
 
                <form onSubmit={handleSubmit}>
                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            label="New Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={!!error}
                            helperText={error}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockOutlined />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            fullWidth
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={!!error}
                            helperText={error}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockOutlined />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Stack>
 
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            type="submit"
                            sx={{
                                borderRadius: '8px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                '&:hover': {
                                    backgroundColor: '#1565C0',
                                },
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            fullWidth
                            onClick={handleBackToLogin}
                            sx={{
                                borderRadius: '8px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                '&:hover': {
                                    borderColor: '#1565C0',
                                },
                            }}
                        >
                            Cancel
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Grid>
    );
}