const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // Facility events
  FACILITY_AVAILABILITY_CHANGED: 'facility:availability_changed',
  FACILITY_STATUS_UPDATED: 'facility:status_updated',
  FACILITY_CREATED: 'facility:created',
  FACILITY_UPDATED: 'facility:updated',
  FACILITY_DELETED: 'facility:deleted',
  
  // Search events
  SEARCH_RESULTS_UPDATED: 'search:results_updated',
  SEARCH_FILTERS_CHANGED: 'search:filters_changed',
  
  // System events
  SYSTEM_MAINTENANCE_MODE: 'system:maintenance_mode',
  SYSTEM_ANNOUNCEMENT: 'system:announcement',
  
  // User events
  USER_PRESENCE_UPDATED: 'user:presence_updated',
  USER_FAVORITES_CHANGED: 'user:favorites_changed',
  
  // Room management
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  
  // Client events
  SUBSCRIBE_TO_FACILITY: 'subscribe_facility',
  UNSUBSCRIBE_FROM_FACILITY: 'unsubscribe_facility',
  SUBSCRIBE_TO_SEARCH: 'subscribe_search',
  UNSUBSCRIBE_FROM_SEARCH: 'unsubscribe_search'
};

const SOCKET_ROOMS = {
  // Global rooms
  ALL_USERS: 'all_users',
  AUTHENTICATED_USERS: 'authenticated_users',
  
  // Facility-specific rooms
  FACILITY_PREFIX: 'facility:',
  FACILITY_AREA_PREFIX: 'area:',
  
  // Search-specific rooms
  SEARCH_PREFIX: 'search:',
  
  // Admin rooms
  ADMIN_NOTIFICATIONS: 'admin:notifications',
  SYSTEM_ALERTS: 'system:alerts'
};

const CONNECTION_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  DISCONNECTING: 'disconnecting',
  DISCONNECTED: 'disconnected'
};

const MESSAGE_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  UPDATE: 'update',
  NOTIFICATION: 'notification'
};

const RATE_LIMITS = {
  // Messages per minute
  GENERAL: 60,
  SUBSCRIPTION: 10,
  ROOM_CHANGES: 5,
  
  // Connection limits
  MAX_ROOMS_PER_USER: 50,
  MAX_FACILITY_SUBSCRIPTIONS: 20
};

module.exports = {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  CONNECTION_STATES,
  MESSAGE_TYPES,
  RATE_LIMITS
};