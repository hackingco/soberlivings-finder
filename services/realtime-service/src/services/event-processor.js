const Event = require('../models/event');
const { 
  REDIS_STREAMS, 
  STREAM_CONFIG, 
  createEventMessage, 
  parseEventMessage, 
  getConsumerName 
} = require('../config/redis-streams');
const { SOCKET_EVENTS } = require('../config/socket');

class EventProcessor {
  constructor(redisClient, io, logger) {
    this.redis = redisClient;
    this.io = io;
    this.logger = logger;
    this.consumerName = getConsumerName('realtime-service');
    this.isRunning = false;
    this.consumers = new Map(); // streamName -> consumer info
    this.processingStats = {
      totalProcessed: 0,
      errors: 0,
      startTime: Date.now(),
      lastProcessedTime: null
    };
  }

  async initialize() {
    try {
      // Initialize consumer groups for all streams
      await this.initializeConsumerGroups();
      
      // Start consuming events from all streams
      this.startConsuming();
      
      this.logger.info('EventProcessor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize EventProcessor:', error);
      throw error;
    }
  }

  async initializeConsumerGroups() {
    const streams = [
      REDIS_STREAMS.FACILITY_EVENTS,
      REDIS_STREAMS.SEARCH_EVENTS,
      REDIS_STREAMS.USER_EVENTS,
      REDIS_STREAMS.SYSTEM_EVENTS
    ];

    for (const stream of streams) {
      try {
        // Create consumer group if it doesn't exist
        await this.redis.xGroupCreate(
          stream, 
          REDIS_STREAMS.REALTIME_CONSUMERS,
          STREAM_CONFIG.CONSUMER_GROUP_CONFIG.START_ID,
          { MKSTREAM: STREAM_CONFIG.CONSUMER_GROUP_CONFIG.MKSTREAM }
        );
        
        this.logger.info(`Initialized consumer group for stream: ${stream}`);
      } catch (error) {
        // Ignore error if group already exists
        if (!error.message.includes('BUSYGROUP')) {
          this.logger.error(`Failed to create consumer group for ${stream}:`, error);
        }
      }
    }
  }

  startConsuming() {
    this.isRunning = true;
    
    // Start consumers for each stream type
    this.startStreamConsumer(REDIS_STREAMS.FACILITY_EVENTS, this.processFacilityEvent.bind(this));
    this.startStreamConsumer(REDIS_STREAMS.SEARCH_EVENTS, this.processSearchEvent.bind(this));
    this.startStreamConsumer(REDIS_STREAMS.USER_EVENTS, this.processUserEvent.bind(this));
    this.startStreamConsumer(REDIS_STREAMS.SYSTEM_EVENTS, this.processSystemEvent.bind(this));
    
    this.logger.info('Event consumers started');
  }

  async startStreamConsumer(streamName, processFunction) {
    const consumer = {
      streamName,
      processFunction,
      isRunning: true,
      errorCount: 0,
      processedCount: 0
    };

    this.consumers.set(streamName, consumer);

    // Start the consumer loop
    this.consumeLoop(consumer);
  }

  async consumeLoop(consumer) {
    while (consumer.isRunning && this.isRunning) {
      try {
        // Read messages from stream
        const messages = await this.redis.xReadGroup(
          REDIS_STREAMS.REALTIME_CONSUMERS,
          this.consumerName,
          { key: consumer.streamName, id: '>' },
          { 
            COUNT: STREAM_CONFIG.READ_COUNT,
            BLOCK: STREAM_CONFIG.BLOCK_TIMEOUT
          }
        );

        if (messages && messages.length > 0) {
          const streamMessages = messages[0];
          if (streamMessages && streamMessages.messages) {
            for (const message of streamMessages.messages) {
              await this.processMessage(consumer, message);
            }
          }
        }

        // Brief pause to prevent tight loop
        await this.sleep(100);

      } catch (error) {
        this.logger.error(`Error in consumer loop for ${consumer.streamName}:`, error);
        consumer.errorCount++;
        this.processingStats.errors++;

        // Exponential backoff on errors
        const backoffTime = Math.min(1000 * Math.pow(2, consumer.errorCount), 30000);
        await this.sleep(backoffTime);
      }
    }

    this.logger.info(`Consumer loop stopped for ${consumer.streamName}`);
  }

  async processMessage(consumer, message) {
    try {
      const event = parseEventMessage(message);
      if (!event) {
        this.logger.warn(`Failed to parse message from ${consumer.streamName}:`, message);
        return;
      }

      // Process the event using the specific handler
      await consumer.processFunction(event);

      // Acknowledge the message
      await this.redis.xAck(
        consumer.streamName,
        REDIS_STREAMS.REALTIME_CONSUMERS,
        event.streamId
      );

      // Update statistics
      consumer.processedCount++;
      this.processingStats.totalProcessed++;
      this.processingStats.lastProcessedTime = Date.now();

      // Reset error count on successful processing
      consumer.errorCount = 0;

    } catch (error) {
      this.logger.error(`Failed to process message from ${consumer.streamName}:`, error);
      consumer.errorCount++;
      this.processingStats.errors++;

      // Handle failed message processing
      await this.handleFailedMessage(consumer, message, error);
    }
  }

  async handleFailedMessage(consumer, message, error) {
    try {
      // Get message delivery count
      const pendingInfo = await this.redis.xPending(
        consumer.streamName,
        REDIS_STREAMS.REALTIME_CONSUMERS,
        '-',
        '+',
        1,
        this.consumerName
      );

      const deliveryCount = pendingInfo && pendingInfo.length > 0 ? 
        pendingInfo[0].deliveryCount : 1;

      if (deliveryCount >= STREAM_CONFIG.MAX_DELIVERY_COUNT) {
        // Send to dead letter queue
        await this.sendToDeadLetter(consumer.streamName, message, error);
        
        // Acknowledge to remove from pending
        await this.redis.xAck(
          consumer.streamName,
          REDIS_STREAMS.REALTIME_CONSUMERS,
          message[0]
        );

        this.logger.warn(`Message sent to dead letter queue after ${deliveryCount} attempts`);
      } else {
        // Will be retried automatically by Redis Streams
        this.logger.info(`Message will be retried (attempt ${deliveryCount}/${STREAM_CONFIG.MAX_DELIVERY_COUNT})`);
      }
    } catch (deadLetterError) {
      this.logger.error('Failed to handle failed message:', deadLetterError);
    }
  }

  async sendToDeadLetter(streamName, message, error) {
    try {
      await this.redis.xAdd(STREAM_CONFIG.DEAD_LETTER_STREAM, '*', {
        originalStream: streamName,
        originalId: message[0],
        error: error.message,
        timestamp: Date.now().toString(),
        messageData: JSON.stringify(message[1])
      });
    } catch (error) {
      this.logger.error('Failed to send message to dead letter queue:', error);
    }
  }

  // Event processing handlers

  async processFacilityEvent(event) {
    try {
      this.logger.debug(`Processing facility event: ${event.type}`, { facilityId: event.data.facilityId });

      switch (event.type) {
        case 'facility:availability_changed':
          await this.handleAvailabilityChanged(event);
          break;
        case 'facility:status_updated':
          await this.handleFacilityStatusUpdated(event);
          break;
        case 'facility:created':
          await this.handleFacilityCreated(event);
          break;
        case 'facility:updated':
          await this.handleFacilityUpdated(event);
          break;
        case 'facility:deleted':
          await this.handleFacilityDeleted(event);
          break;
        default:
          this.logger.warn(`Unknown facility event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process facility event: ${event.type}`, error);
      throw error;
    }
  }

  async processSearchEvent(event) {
    try {
      this.logger.debug(`Processing search event: ${event.type}`);

      switch (event.type) {
        case 'search:results_updated':
          await this.handleSearchResultsUpdated(event);
          break;
        case 'search:index_rebuilt':
          await this.handleSearchIndexRebuilt(event);
          break;
        case 'search:filters_changed':
          await this.handleSearchFiltersChanged(event);
          break;
        default:
          this.logger.warn(`Unknown search event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process search event: ${event.type}`, error);
      throw error;
    }
  }

  async processUserEvent(event) {
    try {
      this.logger.debug(`Processing user event: ${event.type}`, { userId: event.data.userId });

      switch (event.type) {
        case 'user:presence_updated':
          await this.handleUserPresenceUpdated(event);
          break;
        case 'user:favorites_changed':
          await this.handleUserFavoritesChanged(event);
          break;
        case 'user:profile_updated':
          await this.handleUserProfileUpdated(event);
          break;
        default:
          this.logger.warn(`Unknown user event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process user event: ${event.type}`, error);
      throw error;
    }
  }

  async processSystemEvent(event) {
    try {
      this.logger.debug(`Processing system event: ${event.type}`);

      switch (event.type) {
        case 'system:maintenance_mode':
          await this.handleSystemMaintenanceMode(event);
          break;
        case 'system:announcement':
          await this.handleSystemAnnouncement(event);
          break;
        case 'system:alert':
          await this.handleSystemAlert(event);
          break;
        default:
          this.logger.warn(`Unknown system event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process system event: ${event.type}`, error);
      throw error;
    }
  }

  // Specific event handlers

  async handleAvailabilityChanged(event) {
    const { facilityId, current, previous, changes } = event.data;
    
    // Broadcast to facility-specific room
    this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_AVAILABILITY_CHANGED, {
      facilityId,
      availability: current,
      changes,
      timestamp: event.timestamp
    });

    // Broadcast to all users if significant change
    if (changes.availabilityStatus) {
      this.io.to('all_users').emit(SOCKET_EVENTS.FACILITY_AVAILABILITY_CHANGED, {
        facilityId,
        availability: current,
        changes: { availabilityStatus: changes.availabilityStatus },
        timestamp: event.timestamp
      });
    }

    this.logger.info(`Broadcasted availability change for facility ${facilityId}`);
  }

  async handleFacilityStatusUpdated(event) {
    const { facilityId, status, previousStatus } = event.data;
    
    this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_STATUS_UPDATED, {
      facilityId,
      status,
      previousStatus,
      timestamp: event.timestamp
    });

    // Broadcast to authenticated users for major status changes
    if (['active', 'inactive', 'closed'].includes(status) || 
        ['active', 'inactive', 'closed'].includes(previousStatus)) {
      this.io.to('authenticated_users').emit(SOCKET_EVENTS.FACILITY_STATUS_UPDATED, {
        facilityId,
        status,
        previousStatus,
        timestamp: event.timestamp
      });
    }
  }

  async handleFacilityCreated(event) {
    const { facilityId, facility } = event.data;
    
    this.io.to('authenticated_users').emit(SOCKET_EVENTS.FACILITY_CREATED, {
      facilityId,
      facility,
      timestamp: event.timestamp
    });
  }

  async handleFacilityUpdated(event) {
    const { facilityId, updates } = event.data;
    
    this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_UPDATED, {
      facilityId,
      updates,
      timestamp: event.timestamp
    });
  }

  async handleFacilityDeleted(event) {
    const { facilityId } = event.data;
    
    this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_DELETED, {
      facilityId,
      timestamp: event.timestamp
    });

    this.io.to('authenticated_users').emit(SOCKET_EVENTS.FACILITY_DELETED, {
      facilityId,
      timestamp: event.timestamp
    });
  }

  async handleSearchResultsUpdated(event) {
    const { query, results, resultCount } = event.data;
    
    // Broadcast to search-specific room
    const searchId = Buffer.from(query).toString('base64');
    this.io.to(`search:${searchId}`).emit(SOCKET_EVENTS.SEARCH_RESULTS_UPDATED, {
      query,
      results,
      resultCount,
      timestamp: event.timestamp
    });
  }

  async handleSearchIndexRebuilt(event) {
    // Notify all authenticated users about search index updates
    this.io.to('authenticated_users').emit('search:index_rebuilt', {
      message: 'Search index has been updated with latest data',
      timestamp: event.timestamp
    });
  }

  async handleSearchFiltersChanged(event) {
    const { filters } = event.data;
    
    this.io.to('authenticated_users').emit(SOCKET_EVENTS.SEARCH_FILTERS_CHANGED, {
      filters,
      timestamp: event.timestamp
    });
  }

  async handleUserPresenceUpdated(event) {
    const { userId, presence } = event.data;
    
    this.io.to(`user:${userId}`).emit(SOCKET_EVENTS.USER_PRESENCE_UPDATED, {
      userId,
      presence,
      timestamp: event.timestamp
    });
  }

  async handleUserFavoritesChanged(event) {
    const { userId, favorites } = event.data;
    
    this.io.to(`user:${userId}`).emit(SOCKET_EVENTS.USER_FAVORITES_CHANGED, {
      userId,
      favorites,
      timestamp: event.timestamp
    });
  }

  async handleUserProfileUpdated(event) {
    const { userId, updates } = event.data;
    
    this.io.to(`user:${userId}`).emit('user:profile_updated', {
      userId,
      updates,
      timestamp: event.timestamp
    });
  }

  async handleSystemMaintenanceMode(event) {
    const { enabled, message } = event.data;
    
    this.io.to('all_users').emit(SOCKET_EVENTS.SYSTEM_MAINTENANCE_MODE, {
      enabled,
      message,
      timestamp: event.timestamp
    });
  }

  async handleSystemAnnouncement(event) {
    const { message, priority } = event.data;
    
    this.io.to('all_users').emit(SOCKET_EVENTS.SYSTEM_ANNOUNCEMENT, {
      message,
      priority,
      timestamp: event.timestamp
    });
  }

  async handleSystemAlert(event) {
    const { alert, level } = event.data;
    
    // Send alerts to admin room
    this.io.to('admin:notifications').emit('system:alert', {
      alert,
      level,
      timestamp: event.timestamp
    });
  }

  // Utility methods

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProcessingStats() {
    const uptime = Date.now() - this.processingStats.startTime;
    const eventsPerMinute = uptime > 0 ? 
      (this.processingStats.totalProcessed / (uptime / 60000)).toFixed(2) : 0;

    return {
      ...this.processingStats,
      uptime,
      eventsPerMinute,
      consumers: Object.fromEntries(
        Array.from(this.consumers.entries()).map(([name, consumer]) => [
          name,
          {
            processedCount: consumer.processedCount,
            errorCount: consumer.errorCount,
            isRunning: consumer.isRunning
          }
        ])
      )
    };
  }

  async stop() {
    this.isRunning = false;
    
    // Stop all consumers
    for (const consumer of this.consumers.values()) {
      consumer.isRunning = false;
    }

    this.logger.info('EventProcessor stopped');
  }
}

module.exports = EventProcessor;