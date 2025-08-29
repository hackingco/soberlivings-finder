const Event = require('../models/event');
const { SOCKET_EVENTS } = require('../config/socket');

class FacilityUpdateHandler {
  constructor(io, redis, logger, availabilityService) {
    this.io = io;
    this.redis = redis;
    this.logger = logger;
    this.availabilityService = availabilityService;
  }

  async handleFacilityUpdate(facilityId, updateData, metadata = {}) {
    try {
      this.logger.debug(`Handling facility update for ${facilityId}:`, updateData);

      // Get current facility data
      const currentAvailability = await this.availabilityService.getFacilityAvailability(facilityId);

      // Determine update type and priority
      const updateType = this.determineUpdateType(updateData);
      const priority = this.calculateUpdatePriority(updateType, updateData, currentAvailability);

      // Create update event
      const event = new Event('facility:updated', {
        facilityId,
        updateType,
        updates: updateData,
        currentAvailability,
        metadata: {
          ...metadata,
          handlerVersion: '1.0',
          processedAt: Date.now()
        }
      }, {
        priority,
        source: 'facility-update-handler',
        rooms: [`facility:${facilityId}`, 'authenticated_users']
      });

      // Process different types of updates
      await this.processUpdateByType(event);

      // Broadcast the update
      await this.broadcastFacilityUpdate(event);

      // Store update in Redis for analytics
      await this.storeFacilityUpdate(event);

      this.logger.info(`Successfully processed facility update for ${facilityId}: ${updateType}`);

    } catch (error) {
      this.logger.error(`Failed to handle facility update for ${facilityId}:`, error);
      
      // Send error notification to admin
      await this.notifyUpdateError(facilityId, updateData, error);
      throw error;
    }
  }

  determineUpdateType(updateData) {
    // Availability-related updates
    if (updateData.available_beds !== undefined || 
        updateData.total_beds !== undefined ||
        updateData.waiting_list_count !== undefined) {
      return 'availability';
    }

    // Status updates
    if (updateData.status !== undefined) {
      return 'status';
    }

    // Contact information updates
    if (updateData.phone !== undefined || 
        updateData.email !== undefined ||
        updateData.website !== undefined) {
      return 'contact';
    }

    // Location updates
    if (updateData.address !== undefined ||
        updateData.latitude !== undefined ||
        updateData.longitude !== undefined) {
      return 'location';
    }

    // Pricing updates
    if (updateData.monthly_rate !== undefined ||
        updateData.weekly_rate !== undefined ||
        updateData.daily_rate !== undefined) {
      return 'pricing';
    }

    // Service updates
    if (updateData.services !== undefined ||
        updateData.amenities !== undefined ||
        updateData.specialties !== undefined) {
      return 'services';
    }

    // Media updates
    if (updateData.images !== undefined ||
        updateData.virtual_tour !== undefined) {
      return 'media';
    }

    // Description updates
    if (updateData.description !== undefined ||
        updateData.rules !== undefined ||
        updateData.requirements !== undefined) {
      return 'content';
    }

    return 'general';
  }

  calculateUpdatePriority(updateType, updateData, currentAvailability) {
    // Critical priority for availability changes that affect bookability
    if (updateType === 'availability') {
      const hadBeds = currentAvailability && currentAvailability.availableBeds > 0;
      const willHaveBeds = (updateData.available_beds || 0) > 0;
      
      if (hadBeds !== willHaveBeds) {
        return 1; // CRITICAL - availability status change
      }
      
      if (Math.abs((updateData.available_beds || 0) - (currentAvailability?.availableBeds || 0)) >= 5) {
        return 2; // HIGH - significant bed count change
      }
    }

    // Critical priority for status changes
    if (updateType === 'status') {
      const criticalStatuses = ['inactive', 'closed', 'suspended'];
      if (criticalStatuses.includes(updateData.status)) {
        return 1; // CRITICAL
      }
      return 2; // HIGH
    }

    // High priority for pricing changes
    if (updateType === 'pricing') {
      return 2; // HIGH
    }

    // Medium priority for contact and location updates
    if (['contact', 'location'].includes(updateType)) {
      return 3; // MEDIUM
    }

    // Low priority for other updates
    return 4; // LOW
  }

  async processUpdateByType(event) {
    const { updateType, facilityId, updates } = event.data;

    switch (updateType) {
      case 'availability':
        await this.processAvailabilityUpdate(event);
        break;
      case 'status':
        await this.processStatusUpdate(event);
        break;
      case 'pricing':
        await this.processPricingUpdate(event);
        break;
      case 'location':
        await this.processLocationUpdate(event);
        break;
      case 'contact':
        await this.processContactUpdate(event);
        break;
      case 'services':
        await this.processServicesUpdate(event);
        break;
      case 'media':
        await this.processMediaUpdate(event);
        break;
      default:
        await this.processGeneralUpdate(event);
    }
  }

  async processAvailabilityUpdate(event) {
    const { facilityId, updates, currentAvailability } = event.data;

    // Calculate bed changes
    const bedChanges = {
      availableBeds: {
        previous: currentAvailability?.availableBeds || 0,
        current: updates.available_beds || currentAvailability?.availableBeds || 0
      },
      totalBeds: {
        previous: currentAvailability?.totalBeds || 0,
        current: updates.total_beds || currentAvailability?.totalBeds || 0
      }
    };

    // Add bed change information to event
    event.data.bedChanges = bedChanges;

    // Determine if this affects search results
    const affectsAvailability = 
      bedChanges.availableBeds.previous === 0 && bedChanges.availableBeds.current > 0 ||
      bedChanges.availableBeds.previous > 0 && bedChanges.availableBeds.current === 0;

    if (affectsAvailability) {
      // Trigger search index update
      await this.triggerSearchUpdate(facilityId, 'availability_changed');
    }
  }

  async processStatusUpdate(event) {
    const { facilityId, updates } = event.data;

    // Status changes affect search visibility
    if (['active', 'inactive', 'closed'].includes(updates.status)) {
      await this.triggerSearchUpdate(facilityId, 'status_changed');
    }

    // Send critical status change notifications
    if (['inactive', 'closed', 'suspended'].includes(updates.status)) {
      await this.sendCriticalStatusAlert(facilityId, updates.status);
    }
  }

  async processPricingUpdate(event) {
    const { facilityId, updates } = event.data;

    // Calculate price changes percentage
    const priceChanges = {};
    
    if (updates.monthly_rate !== undefined) {
      priceChanges.monthly_rate = {
        current: updates.monthly_rate,
        // Would need to fetch previous value for comparison
      };
    }

    event.data.priceChanges = priceChanges;

    // Pricing changes affect search results
    await this.triggerSearchUpdate(facilityId, 'pricing_changed');
  }

  async processLocationUpdate(event) {
    const { facilityId } = event.data;

    // Location changes require geospatial index updates
    await this.triggerGeospatialUpdate(facilityId, 'location_changed');
    await this.triggerSearchUpdate(facilityId, 'location_changed');
  }

  async processContactUpdate(event) {
    // Contact updates are generally lower priority
    // Just log for now
    this.logger.info(`Contact information updated for facility ${event.data.facilityId}`);
  }

  async processServicesUpdate(event) {
    const { facilityId } = event.data;

    // Service changes affect search filters and results
    await this.triggerSearchUpdate(facilityId, 'services_changed');
  }

  async processMediaUpdate(event) {
    const { facilityId } = event.data;

    // Media updates might affect search ranking
    await this.triggerSearchUpdate(facilityId, 'media_updated');
  }

  async processGeneralUpdate(event) {
    // General updates - minimal processing
    this.logger.debug(`General update processed for facility ${event.data.facilityId}`);
  }

  async broadcastFacilityUpdate(event) {
    const { facilityId, updateType, updates } = event.data;

    // Broadcast to facility-specific subscribers
    this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_UPDATED, {
      facilityId,
      updateType,
      updates,
      timestamp: event.timestamp,
      priority: event.priority
    });

    // Broadcast high-priority updates to wider audience
    if (event.priority <= 2) { // CRITICAL or HIGH
      this.io.to('authenticated_users').emit(SOCKET_EVENTS.FACILITY_UPDATED, {
        facilityId,
        updateType,
        updates: this.sanitizeUpdatesForBroadcast(updates, updateType),
        timestamp: event.timestamp,
        priority: event.priority
      });
    }

    // Send specific availability update event if applicable
    if (updateType === 'availability') {
      this.io.to(`facility:${facilityId}`).emit(SOCKET_EVENTS.FACILITY_AVAILABILITY_CHANGED, {
        facilityId,
        availability: updates,
        bedChanges: event.data.bedChanges,
        timestamp: event.timestamp
      });
    }
  }

  sanitizeUpdatesForBroadcast(updates, updateType) {
    // Only send relevant fields for public broadcast
    const publicFields = {
      availability: ['available_beds', 'total_beds', 'waiting_list_count'],
      status: ['status'],
      pricing: ['monthly_rate', 'weekly_rate', 'daily_rate'],
      location: ['address', 'city', 'state'],
      contact: ['phone', 'email', 'website'],
      services: ['services', 'amenities', 'specialties']
    };

    const allowedFields = publicFields[updateType] || Object.keys(updates);
    
    return Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
  }

  async triggerSearchUpdate(facilityId, changeType) {
    try {
      // Publish to search events stream
      await this.redis.xAdd('search:events', '*', {
        type: 'facility_update_trigger',
        facilityId: facilityId,
        changeType: changeType,
        timestamp: Date.now().toString(),
        source: 'facility-update-handler'
      });

      this.logger.debug(`Triggered search update for facility ${facilityId}: ${changeType}`);
    } catch (error) {
      this.logger.error(`Failed to trigger search update for facility ${facilityId}:`, error);
    }
  }

  async triggerGeospatialUpdate(facilityId, changeType) {
    try {
      // Publish to geospatial update stream
      await this.redis.xAdd('geospatial:events', '*', {
        type: 'facility_location_update',
        facilityId: facilityId,
        changeType: changeType,
        timestamp: Date.now().toString(),
        source: 'facility-update-handler'
      });

      this.logger.debug(`Triggered geospatial update for facility ${facilityId}: ${changeType}`);
    } catch (error) {
      this.logger.error(`Failed to trigger geospatial update for facility ${facilityId}:`, error);
    }
  }

  async sendCriticalStatusAlert(facilityId, newStatus) {
    try {
      // Send to admin notifications
      this.io.to('admin:notifications').emit('facility:critical_status_change', {
        facilityId,
        newStatus,
        timestamp: Date.now(),
        level: 'critical'
      });

      // Store alert for audit trail
      await this.redis.xAdd('system:events', '*', {
        type: 'critical_facility_status',
        facilityId: facilityId,
        status: newStatus,
        timestamp: Date.now().toString(),
        source: 'facility-update-handler',
        priority: '1'
      });

    } catch (error) {
      this.logger.error(`Failed to send critical status alert for facility ${facilityId}:`, error);
    }
  }

  async storeFacilityUpdate(event) {
    try {
      // Store update in Redis hash for analytics
      const key = `facility_updates:${event.data.facilityId}:${Date.now()}`;
      await this.redis.hSet(key, {
        updateType: event.data.updateType,
        priority: event.priority.toString(),
        timestamp: event.timestamp.toString(),
        data: JSON.stringify(event.data.updates)
      });

      // Set expiration (30 days)
      await this.redis.expire(key, 30 * 24 * 60 * 60);

      // Update facility update counter
      await this.redis.incr(`facility_update_count:${event.data.facilityId}`);

    } catch (error) {
      this.logger.error(`Failed to store facility update analytics:`, error);
    }
  }

  async notifyUpdateError(facilityId, updateData, error) {
    try {
      this.io.to('admin:notifications').emit('facility:update_error', {
        facilityId,
        error: error.message,
        updateData: updateData,
        timestamp: Date.now(),
        level: 'error'
      });
    } catch (notificationError) {
      this.logger.error('Failed to send update error notification:', notificationError);
    }
  }

  // Public API methods

  async getFacilityUpdateHistory(facilityId, limit = 50) {
    try {
      const pattern = `facility_updates:${facilityId}:*`;
      const keys = await this.redis.keys(pattern);
      
      // Sort keys by timestamp (descending)
      keys.sort((a, b) => {
        const timestampA = parseInt(a.split(':')[2]);
        const timestampB = parseInt(b.split(':')[2]);
        return timestampB - timestampA;
      });

      const updates = [];
      for (const key of keys.slice(0, limit)) {
        const updateData = await this.redis.hGetAll(key);
        if (updateData && updateData.timestamp) {
          updates.push({
            ...updateData,
            timestamp: parseInt(updateData.timestamp),
            priority: parseInt(updateData.priority),
            data: JSON.parse(updateData.data)
          });
        }
      }

      return updates;
    } catch (error) {
      this.logger.error(`Failed to get update history for facility ${facilityId}:`, error);
      return [];
    }
  }

  async getFacilityUpdateStats(facilityId) {
    try {
      const count = await this.redis.get(`facility_update_count:${facilityId}`);
      return {
        totalUpdates: parseInt(count) || 0,
        facilityId: facilityId
      };
    } catch (error) {
      this.logger.error(`Failed to get update stats for facility ${facilityId}:`, error);
      return { totalUpdates: 0, facilityId: facilityId };
    }
  }
}

module.exports = FacilityUpdateHandler;