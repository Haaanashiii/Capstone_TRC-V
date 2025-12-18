/**
 * Announcement Service API
 * Centralized API calls for announcement management
 */
import api from '../pages/Services/api';
import offlineStorage from './offlineStorage';

/**
 * Handle API response and extract data
 * @param {object} response - Axios response object
 * @returns {object} Response data
 */
const handleResponse = (response) => {
  return response.data;
};

/**
 * Handle API error
 * @param {object} error - Axios error object
 * @throws {Error} Formatted error message
 */
const handleError = (error) => {
  const message = error.response?.data?.message || error.message || 'An error occurred';
  throw new Error(message);
};

/**
 * Announcement Service - All announcement-related API calls
 */
const announcementService = {
  /**
   * Get all announcements with optional pagination
   * @param {object} params - Query parameters (limit, page, search, etc.)
   * @returns {Promise<object>} Announcements data with pagination
   */
  getAll: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.page) queryParams.append('page', params.page);
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const queryString = queryParams.toString();
      const url = `/announcements${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Get a single announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<object>} Announcement data
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/announcements/${id}`);
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Get published announcements (public endpoint)
   * Uses offline cache when network is unavailable
   * @returns {Promise<object>} Published announcements
   */
  getPublished: async () => {
    try {
      const response = await api.get('/announcements/published');
      const data = handleResponse(response);
      
      // Cache for offline use
      if (data.announcements) {
        offlineStorage.saveAnnouncements(data.announcements);
      }
      
      return data;
    } catch (error) {
      // If offline or network error, try to return cached data
      if (!navigator.onLine || error.message === 'Network Error') {
        const cached = offlineStorage.getAnnouncements();
        if (cached?.data) {
          return { 
            announcements: cached.data,
            fromCache: true,
            cacheAge: cached.age
          };
        }
      }
      handleError(error);
    }
  },

  /**
   * Create a new announcement
   * @param {object} announcementData - Announcement data { title, description, date, published }
   * @returns {Promise<object>} Created announcement
   */
  create: async (announcementData) => {
    try {
      const response = await api.post('/announcements', announcementData);
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Update an existing announcement
   * @param {string} id - Announcement ID
   * @param {object} announcementData - Updated announcement data
   * @returns {Promise<object>} Updated announcement
   */
  update: async (id, announcementData) => {
    try {
      const response = await api.put(`/announcements/${id}`, announcementData);
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Delete an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<object>} Deletion confirmation
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/announcements/${id}`);
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Toggle announcement published status
   * @param {object} announcement - Full announcement object
   * @returns {Promise<object>} Updated announcement
   */
  togglePublished: async (announcement) => {
    try {
      const response = await api.put(`/announcements/${announcement._id}`, {
        ...announcement,
        published: !announcement.published
      });
      return handleResponse(response);
    } catch (error) {
      handleError(error);
    }
  }
};

export default announcementService;
