import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Alert,
  Box,
  Typography,
  Paper
} from "@mui/material";
import { CheckCircle, Warning } from "@mui/icons-material";

export default function ReportDriver() {
  const urlParams = new URLSearchParams(window.location.search);
  const driverId = urlParams.get('driver_id');
  
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    passenger_name: "",
    passenger_contact: "",
    passenger_email: "",
    report_type: "overpricing",
    fare_charged: "",
    description: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Mock driver data - replace with actual API call
    const mockDrivers = [
      { id: 1, id_number: driverId || "D001", full_name: "Juan Dela Cruz" },
      { id: 2, id_number: "D002", full_name: "Maria Santos" }
    ];
    setDrivers(mockDrivers);
    
    if (driverId && mockDrivers.length > 0) {
      const driver = mockDrivers.find(d => d.id_number === driverId);
      setSelectedDriver(driver || mockDrivers[0]);
    }
  }, [driverId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;

    setLoading(true);
    
    // Mock API call - replace with actual API call
    const reportData = {
      ...formData,
      driver_id: selectedDriver.id,
      driver_id_number: selectedDriver.id_number,
      driver_name: selectedDriver.full_name,
      fare_charged: formData.fare_charged ? parseFloat(formData.fare_charged) : null,
      report_date: new Date().toISOString(),
    };

    // Simulate API call
    setTimeout(() => {
      console.log('Report submitted:', reportData);
      setLoading(false);
      setShowSuccess(true);
      setFormData({
        passenger_name: "",
        passenger_contact: "",
        passenger_email: "",
        report_type: "overpricing",
        fare_charged: "",
        description: "",
      });
      setTimeout(() => setShowSuccess(false), 5000);
    }, 1000);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <Box sx={{ width: '100%', maxWidth: '100vw' }}>
        {/* Official Header */}
        <Paper 
          elevation={3}
          sx={{ 
            background: 'linear-gradient(to right, #1e3a8a, #1e40af)',
            py: { xs: 1.5, sm: 2 },
            px: { xs: 2, sm: 3 },
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
              <img 
                src="/Logos/TRC-vLogo.png" 
                alt="TRC-V Logo" 
                style={{ 
                  width: '32px', 
                  height: '32px',
                  '@media (min-width: 600px)': {
                    width: '40px',
                    height: '40px'
                  }
                }}
              />
              <Box>
                <Typography 
                  variant="h5"
                  sx={{ 
                    fontWeight: 900, 
                    color: 'white', 
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontSize: { xs: '1.5rem', sm: '2rem' }
                  }}
                >
                  <span style={{ color: '#fbbf24' }}>TRC</span>-V
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 600, 
                    letterSpacing: '0.05em',
                    mt: 0.5,
                    display: 'block',
                    fontSize: { xs: '0.65rem', sm: '0.75rem' }
                  }}
                >
                  TRICYCLE VERIFICATION SYSTEM
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <img 
                src="/Logos/SBLogo.png" 
                alt="Solano Logo" 
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  padding: '3px'
                }}
              />
            </Box>
          </Box>
        </Paper>

        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          {showSuccess ? (
            <Card sx={{ boxShadow: 3, mb: 2, mx: 'auto', maxWidth: '100%' }}>
              <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    width: { xs: 60, sm: 80 }, 
                    height: { xs: 60, sm: 80 }, 
                    backgroundColor: '#dcfce7', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto'
                  }}
                >
                  <CheckCircle sx={{ fontSize: { xs: 30, sm: 40 }, color: '#16a34a' }} />
                </Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: '#111827', 
                    mb: 1,
                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                  }}
                >
                  Report Submitted!
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: '#6b7280', 
                    mb: 3,
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  Thank you for helping us maintain quality service. Your report has been recorded.
                </Typography>
                <Button 
                  onClick={() => window.history.back()}
                  variant="contained"
                  fullWidth
                  sx={{ 
                    backgroundColor: '#2563eb', 
                    '&:hover': { backgroundColor: '#1d4ed8' },
                    py: { xs: 1, sm: 1.5 },
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                >
                  Go Back
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card sx={{ boxShadow: 3, mb: 2, overflow: 'hidden', mx: 'auto', maxWidth: '100%' }}>
                <Box 
                  sx={{ 
                    background: 'linear-gradient(to right, #eab308, #ca8a04)',
                    px: { xs: 2, sm: 3 },
                    py: { xs: 1.5, sm: 2 },
                    color: 'white'
                  }}
                >
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 'bold', 
                      textAlign: 'center',
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    REPORT OPERATOR
                  </Typography>
                </Box>

                {selectedDriver && (
                  <Box 
                    sx={{ 
                      backgroundColor: '#eff6ff', 
                      borderBottom: '2px solid #93c5fd',
                      p: { xs: 1.5, sm: 2 }
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#6b7280', 
                        mb: 0.5, 
                        display: 'block',
                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                      }}
                    >
                      Reporting driver:
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: '#111827',
                        fontSize: { xs: '1rem', sm: '1.25rem' }
                      }}
                    >
                      {selectedDriver.full_name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    >
                      ID: {selectedDriver.id_number}
                    </Typography>
                  </Box>
                )}

                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Alert 
                    icon={<Warning />}
                    severity="warning"
                    sx={{ 
                      mb: { xs: 2, sm: 3 }, 
                      backgroundColor: '#fefce8', 
                      color: '#92400e',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' }
                    }}
                  >
                    Help us keep tricycles safe! Please provide details below.
                  </Alert>

                  <form onSubmit={handleSubmit}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
                      <TextField
                        label="Your Name *"
                        required
                        value={formData.passenger_name}
                        onChange={(e) => setFormData({...formData, passenger_name: e.target.value})}
                        placeholder="Juan Dela Cruz"
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }
                        }}
                      />

                      <TextField
                        label="Contact Number *"
                        required
                        value={formData.passenger_contact}
                        onChange={(e) => setFormData({...formData, passenger_contact: e.target.value})}
                        placeholder="09XX XXX XXXX"
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }
                        }}
                      />

                      <TextField
                        label="Email (Optional)"
                        type="email"
                        value={formData.passenger_email}
                        onChange={(e) => setFormData({...formData, passenger_email: e.target.value})}
                        placeholder="your.email@example.com"
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }
                        }}
                      />

                      <FormControl fullWidth required size="small">
                        <InputLabel sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                          Report Type *
                        </InputLabel>
                        <Select
                          value={formData.report_type}
                          label="Report Type *"
                          onChange={(e) => setFormData({...formData, report_type: e.target.value})}
                          sx={{
                            '& .MuiSelect-select': {
                              fontSize: { xs: '0.875rem', sm: '1rem' }
                            }
                          }}
                        >
                          <MenuItem value="overpricing">Overpricing</MenuItem>
                          <MenuItem value="rude_behavior">Rude Behavior</MenuItem>
                          <MenuItem value="unsafe_driving">Unsafe Driving</MenuItem>
                          <MenuItem value="refusal_of_service">Refusal of Service</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </Select>
                      </FormControl>

                      {formData.report_type === 'overpricing' && (
                        <TextField
                          label="Fare Charged (₱)"
                          type="number"
                          inputProps={{ step: "0.01" }}
                          value={formData.fare_charged}
                          onChange={(e) => setFormData({...formData, fare_charged: e.target.value})}
                          placeholder="50.00"
                          fullWidth
                          variant="outlined"
                          size="small"
                          sx={{
                            '& .MuiInputBase-input': {
                              fontSize: { xs: '0.875rem', sm: '1rem' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: { xs: '0.875rem', sm: '1rem' }
                            }
                          }}
                        />
                      )}

                      <TextField
                        label="Description *"
                        required
                        multiline
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Please provide details about the incident..."
                        fullWidth
                        variant="outlined"
                        size="small"
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }
                        }}
                      />

                      <Button 
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={loading}
                        sx={{ 
                          backgroundColor: '#eab308',
                          '&:hover': { backgroundColor: '#ca8a04' },
                          color: 'white',
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          py: { xs: 1.5, sm: 2 },
                          fontWeight: 'bold',
                          mt: { xs: 1, sm: 0 }
                        }}
                      >
                        {loading ? "Submitting..." : "SUBMIT REPORT"}
                      </Button>
                    </Box>
                  </form>
                </CardContent>
              </Card>

              <Box sx={{ textAlign: 'center', color: '#6b7280', pb: 2, px: 1 }}>
                <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  © Municipality of Solano, Nueva Vizcaya
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}