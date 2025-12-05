import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/Announcement.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import announcementService from '../../services/announcementService';
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
  Snackbar
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

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

  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch announcements from backend
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAll({ limit: 100 });
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

  // Load announcements on component mount and setup WebSocket
  useEffect(() => {
    fetchAnnouncements();

    // Connect to WebSocket announcements room for real-time updates
    if (!websocketService.isConnected()) {
      console.log('[Announcement] Connecting to WebSocket');
      websocketService.connect();  // Auto-joins 'announcements' room
    }

    // Subscribe to announcement updates
    const handleAnnouncementCreated = (newAnnouncement) => {
      console.log('[Announcement] WebSocket event - announcement-created', newAnnouncement);
      setAnnouncements(prev => [newAnnouncement, ...prev]);
    };

    const handleAnnouncementUpdated = (updatedAnnouncement) => {
      console.log('[Announcement] WebSocket event - announcement-updated', updatedAnnouncement);
      setAnnouncements(prev =>
        prev.map(a => a._id === updatedAnnouncement._id ? updatedAnnouncement : a)
      );
    };

    const handleAnnouncementDeleted = (data) => {
      console.log('[Announcement] WebSocket event - announcement-deleted', data);
      setAnnouncements(prev => prev.filter(a => a._id !== data._id));
    };

    websocketService.on('announcement-created', handleAnnouncementCreated);
    websocketService.on('announcement-updated', handleAnnouncementUpdated);
    websocketService.on('announcement-deleted', handleAnnouncementDeleted);

    return () => {
      websocketService.off('announcement-created', handleAnnouncementCreated);
      websocketService.off('announcement-updated', handleAnnouncementUpdated);
      websocketService.off('announcement-deleted', handleAnnouncementDeleted);
    };
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

    try {
      setLoading(true);
      setError('');

      const announcementData = {
        title: newAnnouncement.title,
        description: newAnnouncement.description,
        date: new Date(newAnnouncement.date).toISOString(),
        published: newAnnouncement.published
      };

      if (isEditing) {
        await announcementService.update(selectedAnnouncement._id, announcementData);
      } else {
        await announcementService.create(announcementData);
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
  }, [isEditing, newAnnouncement, selectedAnnouncement, handleCloseModal, fetchAnnouncements]);

  // Handle delete announcement
  const handleDeleteAnnouncement = useCallback(async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      setLoading(true);
      setError('');

      await announcementService.delete(announcementId);

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

    try {
      setLoading(true);

      await announcementService.togglePublished(announcement);

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
  }, [fetchAnnouncements]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
        <div className="page-title">
          Announcement Management
        </div>

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

        <Paper className="admin-table-container" elevation={2}>
          <TableContainer className="admin-table-wrapper">
            <Table className="admin-table" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell className="admin-table-header-cell col-name">Title</TableCell>
                  <TableCell className="admin-table-header-cell">Description</TableCell>
                  <TableCell className="admin-table-header-cell col-date">Date</TableCell>
                  <TableCell className="admin-table-header-cell col-status">Published</TableCell>
                  <TableCell className="admin-table-header-cell col-actions" align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAnnouncements.length > 0 ? (
                  paginatedAnnouncements.map((announcement) => (
                    <TableRow className="admin-table-row" hover key={announcement._id}>
                      <TableCell className="admin-table-cell col-name" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {announcement.title}
                      </TableCell>
                      <TableCell className="admin-table-cell" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {announcement.description}
                      </TableCell>
                      <TableCell className="admin-table-cell col-date">{formatDate(announcement.date)}</TableCell>
                      <TableCell className="admin-table-cell col-status">
                        <Switch
                          checked={announcement.published || false}
                          onChange={() => handleTogglePublished(announcement)}
                          disabled={loading}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell className="admin-table-cell col-actions" align="center">
                        <IconButton
                          className="action-icon-button edit"
                          size="small"
                          onClick={() => handleOpenModal(announcement)}
                          sx={{ mr: 1 }}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          className="action-icon-button delete"
                          size="small"
                          onClick={() => handleDeleteAnnouncement(announcement._id)}
                          color="error"
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="admin-table-row">
                    <TableCell className="admin-table-cell" colSpan={5} align="center">
                      {loading ? 'Loading...' : 'No announcements found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            className="admin-table-pagination"
            component="div"
            count={filteredAnnouncements.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 15, 25, 50]}
          />
        </Paper>

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
                disabled={loading}
                color="primary"
              />
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
