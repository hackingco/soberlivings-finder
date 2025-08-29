const { v4: uuidv4 } = require('uuid');
const { CONNECTION_STATES } = require('../config/socket');

class Connection {
  constructor(socketId, userId = null, metadata = {}) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.userId = userId;
    this.state = CONNECTION_STATES.CONNECTING;
    this.connectedAt = new Date();
    this.lastActivity = new Date();
    this.metadata = {
      userAgent: metadata.userAgent || null,
      ipAddress: metadata.ipAddress || null,
      referer: metadata.referer || null,
      ...metadata
    };
    this.subscriptions = new Set();
    this.rooms = new Set();
    this.messageCount = 0;
    this.lastMessageTime = null;
  }

  authenticate(userId, userdata = {}) {
    this.userId = userId;
    this.state = CONNECTION_STATES.AUTHENTICATED;
    this.metadata = { ...this.metadata, ...userdata };
    this.updateActivity();
  }

  updateActivity() {
    this.lastActivity = new Date();
  }

  addSubscription(subscription) {
    this.subscriptions.add(subscription);
    this.updateActivity();
  }

  removeSubscription(subscription) {
    this.subscriptions.delete(subscription);
    this.updateActivity();
  }

  joinRoom(room) {
    this.rooms.add(room);
    this.updateActivity();
  }

  leaveRoom(room) {
    this.rooms.delete(room);
    this.updateActivity();
  }

  incrementMessageCount() {
    this.messageCount++;
    this.lastMessageTime = new Date();
    this.updateActivity();
  }

  disconnect() {
    this.state = CONNECTION_STATES.DISCONNECTING;
    this.updateActivity();
  }

  isAuthenticated() {
    return this.state === CONNECTION_STATES.AUTHENTICATED && this.userId;
  }

  isActive(timeoutMs = 300000) { // 5 minutes default
    const now = new Date();
    return (now - this.lastActivity) < timeoutMs;
  }

  getConnectionDuration() {
    return new Date() - this.connectedAt;
  }

  toJSON() {
    return {
      id: this.id,
      socketId: this.socketId,
      userId: this.userId,
      state: this.state,
      connectedAt: this.connectedAt.toISOString(),
      lastActivity: this.lastActivity.toISOString(),
      subscriptions: Array.from(this.subscriptions),
      rooms: Array.from(this.rooms),
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime?.toISOString(),
      connectionDuration: this.getConnectionDuration(),
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    const connection = new Connection(data.socketId, data.userId, data.metadata);
    connection.id = data.id;
    connection.state = data.state;
    connection.connectedAt = new Date(data.connectedAt);
    connection.lastActivity = new Date(data.lastActivity);
    connection.messageCount = data.messageCount;
    connection.lastMessageTime = data.lastMessageTime ? new Date(data.lastMessageTime) : null;
    connection.subscriptions = new Set(data.subscriptions || []);
    connection.rooms = new Set(data.rooms || []);
    return connection;
  }
}

module.exports = Connection;