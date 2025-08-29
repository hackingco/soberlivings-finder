const REDIS_STREAMS = {
  // Event streams
  FACILITY_EVENTS: 'facility:events',
  SEARCH_EVENTS: 'search:events',
  USER_EVENTS: 'user:events',
  SYSTEM_EVENTS: 'system:events',
  
  // Consumer groups
  REALTIME_CONSUMERS: 'realtime-consumers',
  NOTIFICATION_CONSUMERS: 'notification-consumers',
  
  // Event types for facility stream
  FACILITY_EVENT_TYPES: {
    AVAILABILITY_CHANGED: 'availability_changed',
    STATUS_UPDATED: 'status_updated',
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    PRICE_CHANGED: 'price_changed',
    IMAGES_UPDATED: 'images_updated'
  },
  
  // Event types for search stream
  SEARCH_EVENT_TYPES: {
    RESULTS_UPDATED: 'results_updated',
    INDEX_REBUILT: 'index_rebuilt',
    FILTERS_CHANGED: 'filters_changed'
  },
  
  // Event types for user stream
  USER_EVENT_TYPES: {
    PRESENCE_UPDATED: 'presence_updated',
    FAVORITES_CHANGED: 'favorites_changed',
    PROFILE_UPDATED: 'profile_updated',
    PREFERENCES_CHANGED: 'preferences_changed'
  },
  
  // Event types for system stream
  SYSTEM_EVENT_TYPES: {
    MAINTENANCE_MODE: 'maintenance_mode',
    ANNOUNCEMENT: 'announcement',
    ALERT: 'alert',
    CONFIG_UPDATED: 'config_updated'
  }
};

const STREAM_CONFIG = {
  // Maximum entries per stream (auto-trim)
  MAX_ENTRIES: 10000,
  
  // Consumer group settings
  CONSUMER_GROUP_CONFIG: {
    // Start from latest message for new groups
    START_ID: '$',
    // Make stream if it doesn't exist
    MKSTREAM: true
  },
  
  // Read timeouts (milliseconds)
  READ_TIMEOUT: 5000,
  BLOCK_TIMEOUT: 1000,
  
  // Batch sizes
  READ_COUNT: 10,
  PROCESS_BATCH_SIZE: 50,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Dead letter handling
  MAX_DELIVERY_COUNT: 5,
  DEAD_LETTER_STREAM: 'dead-letters'
};

const EVENT_PRIORITIES = {
  CRITICAL: 1,    // System alerts, facility unavailable
  HIGH: 2,        // Availability changes, price updates
  MEDIUM: 3,      // General updates, user actions
  LOW: 4          // Background tasks, metrics
};

const createEventMessage = (type, data, metadata = {}) => {
  return {
    type,
    timestamp: Date.now(),
    id: metadata.id || require('uuid').v4(),
    priority: metadata.priority || EVENT_PRIORITIES.MEDIUM,
    source: metadata.source || 'unknown',
    data: typeof data === 'object' ? JSON.stringify(data) : data,
    version: metadata.version || '1.0'
  };
};

const parseEventMessage = (streamEntry) => {
  if (!streamEntry || !streamEntry[1]) {
    return null;
  }
  
  const fields = streamEntry[1];
  const event = {
    streamId: streamEntry[0],
    timestamp: parseInt(fields.timestamp) || Date.now(),
    type: fields.type,
    id: fields.id,
    priority: parseInt(fields.priority) || EVENT_PRIORITIES.MEDIUM,
    source: fields.source || 'unknown',
    version: fields.version || '1.0'
  };
  
  // Parse data field if it's JSON
  try {
    event.data = JSON.parse(fields.data);
  } catch (error) {
    event.data = fields.data;
  }
  
  return event;
};

const getStreamKey = (streamType, suffix = '') => {
  return suffix ? `${streamType}:${suffix}` : streamType;
};

const getConsumerName = (serviceId, workerId = '') => {
  const hostname = require('os').hostname();
  const pid = process.pid;
  return workerId ? 
    `${serviceId}-${hostname}-${pid}-${workerId}` : 
    `${serviceId}-${hostname}-${pid}`;
};

module.exports = {
  REDIS_STREAMS,
  STREAM_CONFIG,
  EVENT_PRIORITIES,
  createEventMessage,
  parseEventMessage,
  getStreamKey,
  getConsumerName
};