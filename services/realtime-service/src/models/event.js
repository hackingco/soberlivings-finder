const { v4: uuidv4 } = require('uuid');
const { EVENT_PRIORITIES } = require('../config/redis-streams');

class Event {
  constructor(type, data, options = {}) {
    this.id = options.id || uuidv4();
    this.type = type;
    this.data = data;
    this.timestamp = options.timestamp || Date.now();
    this.priority = options.priority || EVENT_PRIORITIES.MEDIUM;
    this.source = options.source || 'unknown';
    this.version = options.version || '1.0';
    this.metadata = options.metadata || {};
    this.targets = options.targets || []; // Specific targets for the event
    this.rooms = options.rooms || []; // Rooms to broadcast to
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 3;
    this.processed = false;
    this.processingErrors = [];
  }

  addTarget(target) {
    if (!this.targets.includes(target)) {
      this.targets.push(target);
    }
  }

  addRoom(room) {
    if (!this.rooms.includes(room)) {
      this.rooms.push(room);
    }
  }

  markAsProcessed() {
    this.processed = true;
    this.metadata.processedAt = Date.now();
  }

  addError(error) {
    this.processingErrors.push({
      error: error.message || error,
      timestamp: Date.now(),
      attempt: this.retryCount
    });
  }

  incrementRetry() {
    this.retryCount++;
    return this.retryCount <= this.maxRetries;
  }

  canRetry() {
    return this.retryCount < this.maxRetries;
  }

  isExpired(maxAge = 3600000) { // 1 hour default
    return (Date.now() - this.timestamp) > maxAge;
  }

  getAge() {
    return Date.now() - this.timestamp;
  }

  toRedisStreamFields() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp.toString(),
      priority: this.priority.toString(),
      source: this.source,
      version: this.version,
      data: typeof this.data === 'object' ? JSON.stringify(this.data) : this.data,
      targets: JSON.stringify(this.targets),
      rooms: JSON.stringify(this.rooms),
      metadata: JSON.stringify(this.metadata)
    };
  }

  toSocketPayload() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      data: this.data,
      metadata: this.metadata,
      source: this.source
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      priority: this.priority,
      source: this.source,
      version: this.version,
      metadata: this.metadata,
      targets: this.targets,
      rooms: this.rooms,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      processed: this.processed,
      processingErrors: this.processingErrors,
      age: this.getAge()
    };
  }

  static fromRedisStreamEntry(entry) {
    if (!entry || !entry[1]) {
      return null;
    }

    const fields = entry[1];
    const event = new Event(fields.type, null, {
      id: fields.id,
      timestamp: parseInt(fields.timestamp) || Date.now(),
      priority: parseInt(fields.priority) || EVENT_PRIORITIES.MEDIUM,
      source: fields.source || 'unknown',
      version: fields.version || '1.0'
    });

    // Parse JSON fields
    try {
      event.data = JSON.parse(fields.data);
    } catch (error) {
      event.data = fields.data;
    }

    try {
      event.targets = JSON.parse(fields.targets || '[]');
    } catch (error) {
      event.targets = [];
    }

    try {
      event.rooms = JSON.parse(fields.rooms || '[]');
    } catch (error) {
      event.rooms = [];
    }

    try {
      event.metadata = JSON.parse(fields.metadata || '{}');
    } catch (error) {
      event.metadata = {};
    }

    return event;
  }

  static fromJSON(data) {
    const event = new Event(data.type, data.data, {
      id: data.id,
      timestamp: data.timestamp,
      priority: data.priority,
      source: data.source,
      version: data.version,
      metadata: data.metadata,
      targets: data.targets,
      rooms: data.rooms,
      maxRetries: data.maxRetries
    });

    event.retryCount = data.retryCount || 0;
    event.processed = data.processed || false;
    event.processingErrors = data.processingErrors || [];

    return event;
  }

  // Factory methods for common event types
  static facilityAvailabilityChanged(facilityId, availability, metadata = {}) {
    return new Event('facility:availability_changed', {
      facilityId,
      availability,
      updatedAt: Date.now()
    }, {
      priority: EVENT_PRIORITIES.HIGH,
      source: 'facility-service',
      rooms: [`facility:${facilityId}`, 'all_users'],
      ...metadata
    });
  }

  static facilityStatusUpdated(facilityId, status, previousStatus, metadata = {}) {
    return new Event('facility:status_updated', {
      facilityId,
      status,
      previousStatus,
      updatedAt: Date.now()
    }, {
      priority: EVENT_PRIORITIES.MEDIUM,
      source: 'facility-service',
      rooms: [`facility:${facilityId}`, 'all_users'],
      ...metadata
    });
  }

  static searchResultsUpdated(query, results, metadata = {}) {
    return new Event('search:results_updated', {
      query,
      resultCount: results.length,
      results,
      updatedAt: Date.now()
    }, {
      priority: EVENT_PRIORITIES.MEDIUM,
      source: 'search-service',
      rooms: [`search:${Buffer.from(query).toString('base64')}`, 'authenticated_users'],
      ...metadata
    });
  }

  static systemMaintenanceMode(enabled, message, metadata = {}) {
    return new Event('system:maintenance_mode', {
      enabled,
      message,
      scheduledAt: Date.now()
    }, {
      priority: EVENT_PRIORITIES.CRITICAL,
      source: 'system',
      rooms: ['all_users', 'system:alerts'],
      ...metadata
    });
  }

  static userPresenceUpdated(userId, presence, metadata = {}) {
    return new Event('user:presence_updated', {
      userId,
      presence,
      updatedAt: Date.now()
    }, {
      priority: EVENT_PRIORITIES.LOW,
      source: 'user-service',
      rooms: [`user:${userId}`, 'authenticated_users'],
      ...metadata
    });
  }
}

module.exports = Event;