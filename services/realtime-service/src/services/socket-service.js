const Connection = require('../models/connection');
const { SOCKET_EVENTS, SOCKET_ROOMS, CONNECTION_STATES, RATE_LIMITS } = require('../config/socket');

class SocketService {
  constructor(io, redisClient, logger) {
    this.io = io;
    this.redis = redisClient;
    this.logger = logger;
    this.connections = new Map(); // socketId -> Connection
    this.userConnections = new Map(); // userId -> Set of socketIds
    this.metrics = {
      totalConnections: 0,
      authenticatedConnections: 0,
      messagesProcessed: 0,
      errorsCount: 0,
      startTime: Date.now()
    };
    
    // Rate limiting maps
    this.rateLimiters = new Map(); // socketId -> rate limit data
  }

  async initialize() {
    try {
      // Set up socket connection handling
      this.io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
        this.handleConnection(socket);
      });

      // Load persisted connections from Redis if needed
      await this.loadPersistedConnections();

      this.logger.info('SocketService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SocketService:', error);
      throw error;
    }
  }

  handleConnection(socket) {
    try {
      // Create connection instance
      const connection = new Connection(socket.id, null, {
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        referer: socket.handshake.headers.referer
      });

      this.connections.set(socket.id, connection);
      this.metrics.totalConnections++;

      this.logger.info(`New connection: ${socket.id}`, {
        socketId: socket.id,
        userAgent: connection.metadata.userAgent,
        ipAddress: connection.metadata.ipAddress
      });

      // Set up event handlers
      this.setupSocketEventHandlers(socket, connection);

      // Join general room
      socket.join(SOCKET_ROOMS.ALL_USERS);
      connection.joinRoom(SOCKET_ROOMS.ALL_USERS);

      // Send welcome message
      socket.emit('connection:established', {
        socketId: socket.id,
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      });

      // Set connection state to connected
      connection.state = CONNECTION_STATES.CONNECTED;
      
    } catch (error) {
      this.logger.error('Error handling new connection:', error);
      this.metrics.errorsCount++;
    }
  }

  setupSocketEventHandlers(socket, connection) {
    // Authentication
    socket.on('authenticate', async (data) => {
      await this.handleAuthentication(socket, connection, data);
    });

    // Subscription management
    socket.on(SOCKET_EVENTS.SUBSCRIBE_TO_FACILITY, (data) => {
      this.handleFacilitySubscription(socket, connection, data);
    });

    socket.on(SOCKET_EVENTS.UNSUBSCRIBE_FROM_FACILITY, (data) => {
      this.handleFacilityUnsubscription(socket, connection, data);
    });

    socket.on(SOCKET_EVENTS.SUBSCRIBE_TO_SEARCH, (data) => {
      this.handleSearchSubscription(socket, connection, data);
    });

    socket.on(SOCKET_EVENTS.UNSUBSCRIBE_FROM_SEARCH, (data) => {
      this.handleSearchUnsubscription(socket, connection, data);
    });

    // Room management
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data) => {
      this.handleJoinRoom(socket, connection, data);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data) => {
      this.handleLeaveRoom(socket, connection, data);
    });

    // Disconnect handling
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      this.handleDisconnection(socket, connection, reason);
    });

    // Heartbeat/ping handling
    socket.on('ping', () => {
      connection.updateActivity();
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Error handling
    socket.on('error', (error) => {
      this.logger.error(`Socket error for ${socket.id}:`, error);
      this.metrics.errorsCount++;
    });
  }

  async handleAuthentication(socket, connection, data) {
    try {
      if (!this.checkRateLimit(socket.id, 'auth', 5, 60000)) {
        socket.emit('auth:rate_limited', { message: 'Too many authentication attempts' });
        return;
      }

      const { token, userId } = data;

      // Verify JWT token (implement your JWT verification logic)
      const user = await this.verifyAuthToken(token);
      
      if (!user || user.id !== userId) {
        socket.emit('auth:failed', { message: 'Invalid authentication credentials' });
        return;
      }

      // Authenticate connection
      connection.authenticate(userId, {
        username: user.username,
        role: user.role,
        preferences: user.preferences
      });

      // Join authenticated users room
      socket.join(SOCKET_ROOMS.AUTHENTICATED_USERS);
      connection.joinRoom(SOCKET_ROOMS.AUTHENTICATED_USERS);

      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId).add(socket.id);

      this.metrics.authenticatedConnections++;

      // Store authenticated connection in Redis
      await this.persistConnection(connection);

      socket.emit('auth:success', {
        userId: userId,
        sessionId: connection.id,
        authenticated: true
      });

      this.logger.info(`User authenticated: ${userId} on socket ${socket.id}`);

    } catch (error) {
      this.logger.error('Authentication error:', error);
      socket.emit('auth:error', { message: 'Authentication failed' });
      this.metrics.errorsCount++;
    }
  }

  handleFacilitySubscription(socket, connection, data) {
    try {
      const { facilityId } = data;

      if (!facilityId) {
        socket.emit('subscription:error', { message: 'Facility ID required' });
        return;
      }

      if (!this.checkRateLimit(socket.id, 'subscription', RATE_LIMITS.SUBSCRIPTION, 60000)) {
        socket.emit('subscription:rate_limited', { message: 'Too many subscription attempts' });
        return;
      }

      const facilityRoom = `${SOCKET_ROOMS.FACILITY_PREFIX}${facilityId}`;
      
      socket.join(facilityRoom);
      connection.joinRoom(facilityRoom);
      connection.addSubscription(`facility:${facilityId}`);

      socket.emit('subscription:success', {
        type: 'facility',
        facilityId: facilityId,
        room: facilityRoom
      });

      this.logger.debug(`Socket ${socket.id} subscribed to facility ${facilityId}`);

    } catch (error) {
      this.logger.error('Facility subscription error:', error);
      socket.emit('subscription:error', { message: 'Subscription failed' });
      this.metrics.errorsCount++;
    }
  }

  handleFacilityUnsubscription(socket, connection, data) {
    try {
      const { facilityId } = data;

      if (!facilityId) {
        socket.emit('unsubscription:error', { message: 'Facility ID required' });
        return;
      }

      const facilityRoom = `${SOCKET_ROOMS.FACILITY_PREFIX}${facilityId}`;
      
      socket.leave(facilityRoom);
      connection.leaveRoom(facilityRoom);
      connection.removeSubscription(`facility:${facilityId}`);

      socket.emit('unsubscription:success', {
        type: 'facility',
        facilityId: facilityId,
        room: facilityRoom
      });

      this.logger.debug(`Socket ${socket.id} unsubscribed from facility ${facilityId}`);

    } catch (error) {
      this.logger.error('Facility unsubscription error:', error);
      socket.emit('unsubscription:error', { message: 'Unsubscription failed' });
      this.metrics.errorsCount++;
    }
  }

  handleSearchSubscription(socket, connection, data) {
    try {
      const { query, filters } = data;

      if (!query) {
        socket.emit('subscription:error', { message: 'Search query required' });
        return;
      }

      if (!this.checkRateLimit(socket.id, 'subscription', RATE_LIMITS.SUBSCRIPTION, 60000)) {
        socket.emit('subscription:rate_limited', { message: 'Too many subscription attempts' });
        return;
      }

      // Create a unique room name for this search query
      const searchId = Buffer.from(JSON.stringify({ query, filters })).toString('base64');
      const searchRoom = `${SOCKET_ROOMS.SEARCH_PREFIX}${searchId}`;
      
      socket.join(searchRoom);
      connection.joinRoom(searchRoom);
      connection.addSubscription(`search:${searchId}`);

      socket.emit('subscription:success', {
        type: 'search',
        query: query,
        searchId: searchId,
        room: searchRoom
      });

      this.logger.debug(`Socket ${socket.id} subscribed to search: ${query}`);

    } catch (error) {
      this.logger.error('Search subscription error:', error);
      socket.emit('subscription:error', { message: 'Search subscription failed' });
      this.metrics.errorsCount++;
    }
  }

  handleSearchUnsubscription(socket, connection, data) {
    try {
      const { searchId } = data;

      if (!searchId) {
        socket.emit('unsubscription:error', { message: 'Search ID required' });
        return;
      }

      const searchRoom = `${SOCKET_ROOMS.SEARCH_PREFIX}${searchId}`;
      
      socket.leave(searchRoom);
      connection.leaveRoom(searchRoom);
      connection.removeSubscription(`search:${searchId}`);

      socket.emit('unsubscription:success', {
        type: 'search',
        searchId: searchId,
        room: searchRoom
      });

      this.logger.debug(`Socket ${socket.id} unsubscribed from search ${searchId}`);

    } catch (error) {
      this.logger.error('Search unsubscription error:', error);
      socket.emit('unsubscription:error', { message: 'Search unsubscription failed' });
      this.metrics.errorsCount++;
    }
  }

  handleJoinRoom(socket, connection, data) {
    try {
      const { room } = data;

      if (!room || typeof room !== 'string') {
        socket.emit('room:error', { message: 'Valid room name required' });
        return;
      }

      if (!this.checkRateLimit(socket.id, 'room_changes', RATE_LIMITS.ROOM_CHANGES, 60000)) {
        socket.emit('room:rate_limited', { message: 'Too many room changes' });
        return;
      }

      if (connection.rooms.size >= RATE_LIMITS.MAX_ROOMS_PER_USER) {
        socket.emit('room:error', { message: 'Maximum rooms limit reached' });
        return;
      }

      socket.join(room);
      connection.joinRoom(room);

      socket.emit('room:joined', { room: room });

      this.logger.debug(`Socket ${socket.id} joined room ${room}`);

    } catch (error) {
      this.logger.error('Join room error:', error);
      socket.emit('room:error', { message: 'Failed to join room' });
      this.metrics.errorsCount++;
    }
  }

  handleLeaveRoom(socket, connection, data) {
    try {
      const { room } = data;

      if (!room || typeof room !== 'string') {
        socket.emit('room:error', { message: 'Valid room name required' });
        return;
      }

      socket.leave(room);
      connection.leaveRoom(room);

      socket.emit('room:left', { room: room });

      this.logger.debug(`Socket ${socket.id} left room ${room}`);

    } catch (error) {
      this.logger.error('Leave room error:', error);
      socket.emit('room:error', { message: 'Failed to leave room' });
      this.metrics.errorsCount++;
    }
  }

  handleDisconnection(socket, connection, reason) {
    try {
      this.logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);

      // Remove from user connections tracking
      if (connection.userId && this.userConnections.has(connection.userId)) {
        this.userConnections.get(connection.userId).delete(socket.id);
        
        if (this.userConnections.get(connection.userId).size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }

      // Update connection state
      connection.disconnect();

      // Remove from connections map
      this.connections.delete(socket.id);

      // Update metrics
      if (connection.isAuthenticated()) {
        this.metrics.authenticatedConnections--;
      }

      // Clean up rate limiters
      this.rateLimiters.delete(socket.id);

      // Remove persisted connection
      this.removePersistedConnection(connection.id);

    } catch (error) {
      this.logger.error('Disconnection handling error:', error);
      this.metrics.errorsCount++;
    }
  }

  checkRateLimit(socketId, operation, limit, windowMs) {
    const key = `${socketId}:${operation}`;
    const now = Date.now();

    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, { count: 1, windowStart: now });
      return true;
    }

    const rateLimitData = this.rateLimiters.get(key);

    if (now - rateLimitData.windowStart > windowMs) {
      // Reset window
      rateLimitData.count = 1;
      rateLimitData.windowStart = now;
      return true;
    }

    if (rateLimitData.count >= limit) {
      return false;
    }

    rateLimitData.count++;
    return true;
  }

  async verifyAuthToken(token) {
    // Implement JWT verification logic
    // This is a placeholder - replace with your actual JWT verification
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      return decoded;
    } catch (error) {
      this.logger.error('JWT verification failed:', error);
      return null;
    }
  }

  async persistConnection(connection) {
    try {
      const key = `connection:${connection.id}`;
      await this.redis.setEx(key, 3600, JSON.stringify(connection.toJSON()));
    } catch (error) {
      this.logger.error('Failed to persist connection:', error);
    }
  }

  async removePersistedConnection(connectionId) {
    try {
      const key = `connection:${connectionId}`;
      await this.redis.del(key);
    } catch (error) {
      this.logger.error('Failed to remove persisted connection:', error);
    }
  }

  async loadPersistedConnections() {
    try {
      const keys = await this.redis.keys('connection:*');
      this.logger.info(`Loading ${keys.length} persisted connections`);
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const connectionData = JSON.parse(data);
          // Connections will be reestablished when users reconnect
          await this.redis.del(key);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load persisted connections:', error);
    }
  }

  // Broadcast methods
  broadcastToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
    this.metrics.messagesProcessed++;
  }

  broadcastToUser(userId, event, data) {
    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit(event, data);
      }
      this.metrics.messagesProcessed++;
    }
  }

  broadcastToAll(event, data) {
    this.io.emit(event, data);
    this.metrics.messagesProcessed++;
  }

  // Metrics and status
  getAuthenticatedCount() {
    return this.metrics.authenticatedConnections;
  }

  async getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      ...this.metrics,
      uptime,
      connectionsPerMinute: (this.metrics.totalConnections / (uptime / 60000)).toFixed(2),
      messagesPerMinute: (this.metrics.messagesProcessed / (uptime / 60000)).toFixed(2),
      currentConnections: this.connections.size,
      activeRooms: await this.getActiveRoomsCount()
    };
  }

  async getActiveRoomsCount() {
    try {
      const rooms = await this.io.of('/').adapter.allRooms();
      return rooms.size;
    } catch (error) {
      return 0;
    }
  }

  getConnectionById(socketId) {
    return this.connections.get(socketId);
  }

  getUserConnections(userId) {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) return [];
    
    return Array.from(socketIds).map(id => this.connections.get(id)).filter(Boolean);
  }
}

module.exports = SocketService;