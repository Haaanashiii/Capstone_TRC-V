/**
 * WebSocket Service for Real-Time Communication
 * Handles Socket.IO connections for admin dashboard
 */

import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { API_BASE_URL, TokenManager } from '../pages/Services/api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.currentRoom = null; // Track current room
  }

  /**
   * Initialize WebSocket connection
   * @param {string} room - Room to join ('bplo-admins', 'sb-admins', 'users')
   */
  connect(room = null) {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected, current room:', this.currentRoom);
      // If a different room is requested, switch to it
      if (room && room !== this.currentRoom) {
        console.log('[WebSocket] Switching from room:', this.currentRoom, 'to:', room);
        this.joinRoom(room);
      }
      return;
    }

    const token = TokenManager.getAccessToken();
    
    console.log('[WebSocket] Attempting to connect to:', API_BASE_URL);
    console.log('[WebSocket] Token available:', !!token);
    
    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token || ''
      },
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket.id);
      this.reconnectAttempts = 0;
      
      // Join room if specified
      if (room) {
        this.joinRoom(room);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      console.error('[WebSocket] Error details:', {
        message: error.message,
        data: error.data,
        type: error.type
      });
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed');
    });

    return this.socket;
  }

  /**
   * Join a specific room for role-based updates
   * @param {string} room - Room name ('bplo-admins', 'sb-admins', 'users', 'general')
   */
  joinRoom(room) {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Cannot join room - not connected');
      return;
    }

    console.log('[WebSocket] Joining room:', room, '(was in:', this.currentRoom + ')');
    this.currentRoom = room; // Track the current room
    this.socket.emit('join-room', room);
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn('[WebSocket] Socket not initialized');
      return;
    }

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    this.socket.on(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.socket) return;

    this.socket.off(event, callback);

    // Remove from listeners map
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {*} data - Data to send
   */
  emit(event, data) {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Cannot emit - not connected');
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (!this.socket) return;

    console.log('[WebSocket] Disconnecting...');

    // Remove all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket.off(event, callback);
      });
    });
    this.listeners.clear();

    this.socket.disconnect();
    this.socket = null;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance
   */
  getSocket() {
    return this.socket;
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;

/**
 * React Hook for WebSocket
 * Usage in components:
 * 
 * import { useWebSocket } from '../services/websocket';
 * 
 * function MyComponent() {
 *   useWebSocket('pending-applications', (data) => {
 *     console.log('New application:', data);
 *   }, 'bplo-admins');
 * 
 *   return <div>...</div>;
 * }
 */
export const useWebSocket = (event, callback, room = null) => {
  useEffect(() => {
    // Connect and join room
    if (!websocketService.isConnected()) {
      websocketService.connect(room);
    } else if (room) {
      websocketService.joinRoom(room);
    }

    // Subscribe to event
    websocketService.on(event, callback);

    // Cleanup
    return () => {
      websocketService.off(event, callback);
    };
  }, [event, callback, room]);

  return websocketService;
};
