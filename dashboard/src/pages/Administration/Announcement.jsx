import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/Announcement.css';
import Sidebar from './Sidebar';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  InputAdornment,
  Modal,
  IconButton,
  CircularProgress,
  Alert,
  Switch,
  Snackbar,
  tableCellClasses
} from '@mui/material';

import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Styled components for table
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: '#0A356B',
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: '#f9f9f9',
  },
  '&:hover': {
    backgroundColor: 'rgba(10, 53, 107, 0.08)',
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const INITIAL_ANNOUNCEMENT_STATE = {
  title: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  published: false
};

function Announcement() {
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [newAnnouncement, setNewAnnouncement] = useState(INITIAL_ANNOUNCEMENT_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const rowsPerPage = 5;

  // Fetch announcements from backend
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/announcements?limit=100`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
      setError('');
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements. Please try again.');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load announcements on component mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Memoized filtered announcements
  const filteredAnnouncements = useMemo(() => {
    if (!searchQuery.trim()) return announcements;

    const query = searchQuery.toLowerCase();
    return announcements.filter(announcement =>
      announcement.title?.toLowerCase().includes(query) ||
      announcement.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, announcements]);

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  // Memoized paginated announcements
  const paginatedAnnouncements = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredAnnouncements.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAnnouncements, page, rowsPerPage]);

  // Count published announcements
  const publishedCount = useMemo(() => {
    return announcements.filter(a => a.published).length;
  }, [announcements]);

  // Handle modal open
  const handleOpenModal = useCallback((announcement = null) => {
    setIsEditing(!!announcement);
    setSelectedAnnouncement(announcement);
    setNewAnnouncement(announcement ? {
      title: announcement.title,
      description: announcement.description,
      date: new Date(announcement.date).toISOString().split('T')[0],
      published: announcement.published || false
    } : INITIAL_ANNOUNCEMENT_STATE);
    setOpenModal(true);
    setError('');
    setSuccess('');
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpenModal(false);
    setSelectedAnnouncement(null);
    setNewAnnouncement(INITIAL_ANNOUNCEMENT_STATE);
    setError('');
    setSuccess('');
  }, []);

  // Handle add/update announcement
  const handleSaveAnnouncement = useCallback(async () => {
    // Validation
    if (!newAnnouncement.title || !newAnnouncement.description || !newAnnouncement.date) {
      setError('Please fill in all required fields');
      return;
    }

    // Check published limit
    if (newAnnouncement.published && !isEditing) {
      if (publishedCount >= 3) {
        setError('Only 3 announcements can be published at a time. Please unpublish one first.');
        return;
      }
    } else if (newAnnouncement.published && isEditing && !selectedAnnouncement.published) {
      if (publishedCount >= 3) {
        setError('Only 3 announcements can be published at a time. Please unpublish one first.');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const announcementData = {
        title: newAnnouncement.title,
        description: newAnnouncement.description,
        date: new Date(newAnnouncement.date).toISOString(),
        published: newAnnouncement.published
      };

      const url = isEditing
        ? `${API_BASE_URL}/announcements/${selectedAnnouncement._id}`
        : `${API_BASE_URL}/announcements`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(announcementData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${isEditing ? 'update' : 'create'} announcement`);
      }

      setSuccess(`Announcement ${isEditing ? 'updated' : 'created'} successfully`);
      await fetchAnnouncements();

      setTimeout(() => {
        handleCloseModal();
      }, 1500);
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} announcement:`, err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} announcement`);
    } finally {
      setLoading(false);
    }
  }, [isEditing, newAnnouncement, selectedAnnouncement, publishedCount, handleCloseModal, fetchAnnouncements]);

  // Handle delete announcement
  const handleDeleteAnnouncement = useCallback(async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete announcement');
      }

      setSnackbar({
        open: true,
        message: 'Announcement deleted successfully',
        severity: 'success'
      });
      await fetchAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setSnackbar({
        open: true,
        message: err.message || 'Failed to delete announcement',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAnnouncements]);

  // Handle toggle published status
  const handleTogglePublished = useCallback(async (announcement) => {
    const newPublishedStatus = !announcement.published;

    // Check if trying to publish when 3 are already published
    if (newPublishedStatus && !announcement.published && publishedCount >= 3) {
      setSnackbar({
        open: true,
        message: 'Only 3 announcements can be published at a time. Please unpublish one first.',
        severity: 'warning'
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/announcements/${announcement._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          ...announcement,
          published: newPublishedStatus
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update announcement');
      }

      setSnackbar({
        open: true,
        message: `Announcement ${newPublishedStatus ? 'published' : 'unpublished'} successfully`,
        severity: 'success'
      });
      await fetchAnnouncements();
    } catch (err) {
      console.error('Error toggling published status:', err);
      setSnackbar({
        open: true,
        message: err.message || 'Failed to update announcement',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [publishedCount, fetchAnnouncements]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    setNewAnnouncement(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar({ ...snackbar, open: false });
  }, [snackbar]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="announcement-management-container">
      <Sidebar />
      <div className="content-area">
        <Box className="announcement-management-box">
          <Typography variant="h5" component="h1" className="announcement-management-title">
            Announcement Management
          </Typography>

          {/* Success/Error Messages */}
          {error && !openModal && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && !openModal && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Published Announcements: <strong>{publishedCount} / 3</strong>
              {publishedCount >= 3 && (
                <span style={{ color: '#f57c00', marginLeft: 8 }}>
                  (Maximum reached - unpublish one to publish another)
                </span>
              )}
            </Typography>
          </Box>

          <Box className="announcement-management-toolbar">
            <TextField
              placeholder="Search announcements..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
              disabled={loading}
              className="add-announcement-btn"
            >
              Add Announcement
            </Button>
          </Box>

          {loading && !openModal && (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          )}

          <TableContainer component={Paper} elevation={2}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Title</StyledTableCell>
                  <StyledTableCell>Description</StyledTableCell>
                  <StyledTableCell>Date</StyledTableCell>
                  <StyledTableCell>Published</StyledTableCell>
                  <StyledTableCell align="center">Actions</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAnnouncements.length > 0 ? (
                  paginatedAnnouncements.map((announcement) => (
                    <StyledTableRow key={announcement._id}>
                      <StyledTableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {announcement.title}
                      </StyledTableCell>
                      <StyledTableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {announcement.description}
                      </StyledTableCell>
                      <StyledTableCell>{formatDate(announcement.date)}</StyledTableCell>
                      <StyledTableCell>
                        <Switch
                          checked={announcement.published || false}
                          onChange={() => handleTogglePublished(announcement)}
                          disabled={loading || (!announcement.published && publishedCount >= 3)}
                          color="primary"
                        />
                      </StyledTableCell>
                      <StyledTableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenModal(announcement)}
                          sx={{ mr: 1 }}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteAnnouncement(announcement._id)}
                          color="error"
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </StyledTableCell>
                    </StyledTableRow>
                  ))
                ) : (
                  <StyledTableRow>
                    <StyledTableCell colSpan={5} align="center">
                      {loading ? 'Loading...' : 'No announcements found'}
                    </StyledTableCell>
                  </StyledTableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredAnnouncements.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
          />
        </Box>

        {/* Add/Edit Announcement Modal */}
        <Modal open={openModal} onClose={handleCloseModal}>
          <Box className="announcement-modal-box">
            <Typography variant="h6" component="h2" className="announcement-modal-title">
              {isEditing ? 'Edit Announcement' : 'Add New Announcement'}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Title"
              name="title"
              margin="normal"
              value={newAnnouncement.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              required
              disabled={loading}
              inputProps={{ maxLength: 200 }}
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              margin="normal"
              multiline
              rows={4}
              value={newAnnouncement.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              required
              disabled={loading}
              inputProps={{ maxLength: 500 }}
              helperText={`${newAnnouncement.description.length}/500 characters`}
            />
            <TextField
              fullWidth
              label="Date"
              name="date"
              margin="normal"
              type="date"
              value={newAnnouncement.date}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              required
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Typography>Publish to Landing Page:</Typography>
              <Switch
                checked={newAnnouncement.published}
                onChange={(e) => handleFieldChange('published', e.target.checked)}
                disabled={loading || (!isEditing && publishedCount >= 3) || (isEditing && !selectedAnnouncement?.published && publishedCount >= 3)}
                color="primary"
              />
              {!isEditing && publishedCount >= 3 && (
                <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                  Maximum 3 published
                </Typography>
              )}
            </Box>

            <Box className="announcement-modal-actions">
              <Button onClick={handleCloseModal} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAnnouncement}
                variant="contained"
                disabled={loading}
                className="announcement-modal-submit-btn"
              >
                {loading ? <CircularProgress size={24} /> : (isEditing ? 'Save Changes' : 'Add Announcement')}
              </Button>
            </Box>
          </Box>
        </Modal>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}

export default Announcement;
