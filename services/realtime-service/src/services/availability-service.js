const { Pool } = require('pg');

class AvailabilityService {
  constructor(redisClient, logger) {
    this.redis = redisClient;
    this.logger = logger;
    this.pgPool = null;
    this.intervalId = null;
    this.availabilityCache = new Map(); // facilityId -> availability data
    this.lastUpdateTime = new Map(); // facilityId -> last update timestamp
    this.checkInterval = parseInt(process.env.AVAILABILITY_CHECK_INTERVAL) || 30000; // 30 seconds
  }

  async initialize() {
    try {
      // Initialize PostgreSQL connection pool
      this.pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'soberlivings',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test database connection
      await this.pgPool.query('SELECT NOW()');
      this.logger.info('PostgreSQL connection pool initialized');

      // Load initial availability data
      await this.loadInitialAvailability();

      // Start availability monitoring
      this.startAvailabilityMonitoring();

      this.logger.info('AvailabilityService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AvailabilityService:', error);
      throw error;
    }
  }

  async loadInitialAvailability() {
    try {
      const query = `
        SELECT 
          id,
          available_beds,
          total_beds,
          waiting_list_count,
          last_updated,
          status
        FROM facilities 
        WHERE status = 'active'
      `;

      const result = await this.pgPool.query(query);
      
      for (const facility of result.rows) {
        const availabilityData = {
          facilityId: facility.id,
          availableBeds: facility.available_beds || 0,
          totalBeds: facility.total_beds || 0,
          waitingListCount: facility.waiting_list_count || 0,
          lastUpdated: facility.last_updated,
          status: facility.status,
          occupancyRate: facility.total_beds > 0 ? 
            ((facility.total_beds - (facility.available_beds || 0)) / facility.total_beds * 100).toFixed(1) : 0
        };

        this.availabilityCache.set(facility.id, availabilityData);
        this.lastUpdateTime.set(facility.id, Date.now());

        // Store in Redis for persistence
        await this.cacheAvailabilityInRedis(facility.id, availabilityData);
      }

      this.logger.info(`Loaded availability for ${result.rows.length} facilities`);
    } catch (error) {
      this.logger.error('Failed to load initial availability:', error);
      throw error;
    }
  }

  startAvailabilityMonitoring() {
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAvailabilityUpdates();
      } catch (error) {
        this.logger.error('Error in availability monitoring:', error);
      }
    }, this.checkInterval);

    this.logger.info(`Started availability monitoring with ${this.checkInterval}ms interval`);
  }

  async checkAvailabilityUpdates() {
    try {
      // Query for facilities with recent updates
      const query = `
        SELECT 
          id,
          available_beds,
          total_beds,
          waiting_list_count,
          last_updated,
          status
        FROM facilities 
        WHERE 
          status = 'active' 
          AND last_updated > NOW() - INTERVAL '2 minutes'
        ORDER BY last_updated DESC
      `;

      const result = await this.pgPool.query(query);

      for (const facility of result.rows) {
        await this.processAvailabilityUpdate(facility);
      }

      if (result.rows.length > 0) {
        this.logger.debug(`Processed ${result.rows.length} availability updates`);
      }
    } catch (error) {
      this.logger.error('Failed to check availability updates:', error);
    }
  }

  async processAvailabilityUpdate(facilityData) {
    try {
      const facilityId = facilityData.id;
      const currentData = this.availabilityCache.get(facilityId);
      
      const newData = {
        facilityId: facilityId,
        availableBeds: facilityData.available_beds || 0,
        totalBeds: facilityData.total_beds || 0,
        waitingListCount: facilityData.waiting_list_count || 0,
        lastUpdated: facilityData.last_updated,
        status: facilityData.status,
        occupancyRate: facilityData.total_beds > 0 ? 
          ((facilityData.total_beds - (facilityData.available_beds || 0)) / facilityData.total_beds * 100).toFixed(1) : 0
      };

      // Check if there are significant changes
      const hasSignificantChange = !currentData || 
        currentData.availableBeds !== newData.availableBeds ||
        currentData.totalBeds !== newData.totalBeds ||
        currentData.waitingListCount !== newData.waitingListCount ||
        currentData.status !== newData.status;

      if (hasSignificantChange) {
        // Update cache
        this.availabilityCache.set(facilityId, newData);
        this.lastUpdateTime.set(facilityId, Date.now());

        // Cache in Redis
        await this.cacheAvailabilityInRedis(facilityId, newData);

        // Publish availability change event
        await this.publishAvailabilityChange(facilityId, newData, currentData);

        this.logger.info(`Availability updated for facility ${facilityId}:`, {
          previous: currentData ? currentData.availableBeds : 'new',
          current: newData.availableBeds,
          occupancyRate: newData.occupancyRate + '%'
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process availability update for facility ${facilityData.id}:`, error);
    }
  }

  async publishAvailabilityChange(facilityId, newData, previousData) {
    try {
      const changeEvent = {
        type: 'facility:availability_changed',
        facilityId: facilityId,
        timestamp: Date.now(),
        data: {
          current: newData,
          previous: previousData,
          changes: this.calculateChanges(previousData, newData)
        }
      };

      // Publish to Redis stream for event processing
      await this.redis.xAdd('facility:events', '*', {
        type: changeEvent.type,
        facilityId: facilityId,
        timestamp: changeEvent.timestamp.toString(),
        data: JSON.stringify(changeEvent.data),
        priority: this.calculatePriority(changeEvent.data.changes).toString()
      });

      this.logger.debug(`Published availability change event for facility ${facilityId}`);
    } catch (error) {
      this.logger.error(`Failed to publish availability change for facility ${facilityId}:`, error);
    }
  }

  calculateChanges(previousData, newData) {
    const changes = {};

    if (!previousData) {
      changes.type = 'new_facility';
      changes.availableBeds = { from: null, to: newData.availableBeds };
      return changes;
    }

    if (previousData.availableBeds !== newData.availableBeds) {
      changes.availableBeds = {
        from: previousData.availableBeds,
        to: newData.availableBeds,
        delta: newData.availableBeds - previousData.availableBeds
      };
    }

    if (previousData.totalBeds !== newData.totalBeds) {
      changes.totalBeds = {
        from: previousData.totalBeds,
        to: newData.totalBeds,
        delta: newData.totalBeds - previousData.totalBeds
      };
    }

    if (previousData.waitingListCount !== newData.waitingListCount) {
      changes.waitingListCount = {
        from: previousData.waitingListCount,
        to: newData.waitingListCount,
        delta: newData.waitingListCount - previousData.waitingListCount
      };
    }

    if (previousData.status !== newData.status) {
      changes.status = {
        from: previousData.status,
        to: newData.status
      };
    }

    // Calculate availability status changes
    const previouslyAvailable = (previousData.availableBeds || 0) > 0;
    const currentlyAvailable = (newData.availableBeds || 0) > 0;

    if (previouslyAvailable !== currentlyAvailable) {
      changes.availabilityStatus = {
        from: previouslyAvailable ? 'available' : 'unavailable',
        to: currentlyAvailable ? 'available' : 'unavailable'
      };
    }

    return changes;
  }

  calculatePriority(changes) {
    // Critical: Facility becomes unavailable or available
    if (changes.availabilityStatus) {
      return 1; // CRITICAL
    }

    // High: Significant bed count changes
    if (changes.availableBeds && Math.abs(changes.availableBeds.delta) >= 5) {
      return 2; // HIGH
    }

    // Medium: Any bed count changes or status changes
    if (changes.availableBeds || changes.totalBeds || changes.status) {
      return 3; // MEDIUM
    }

    // Low: Waiting list changes only
    return 4; // LOW
  }

  async cacheAvailabilityInRedis(facilityId, availabilityData) {
    try {
      const key = `availability:${facilityId}`;
      await this.redis.setEx(key, 3600, JSON.stringify(availabilityData)); // 1 hour TTL
      
      // Also add to sorted set for quick queries by occupancy rate
      await this.redis.zAdd('availability:by_occupancy', [
        { score: parseFloat(availabilityData.occupancyRate), value: facilityId }
      ]);
      
      // Add to available beds sorted set
      await this.redis.zAdd('availability:by_beds', [
        { score: availabilityData.availableBeds, value: facilityId }
      ]);

    } catch (error) {
      this.logger.error(`Failed to cache availability in Redis for facility ${facilityId}:`, error);
    }
  }

  // Public API methods

  async getFacilityAvailability(facilityId) {
    try {
      // Try cache first
      let availability = this.availabilityCache.get(facilityId);

      if (!availability) {
        // Fallback to Redis
        const redisKey = `availability:${facilityId}`;
        const cached = await this.redis.get(redisKey);
        if (cached) {
          availability = JSON.parse(cached);
          this.availabilityCache.set(facilityId, availability);
        }
      }

      if (!availability) {
        // Fallback to database
        const query = `
          SELECT 
            id,
            available_beds,
            total_beds,
            waiting_list_count,
            last_updated,
            status
          FROM facilities 
          WHERE id = $1
        `;

        const result = await this.pgPool.query(query, [facilityId]);
        
        if (result.rows.length > 0) {
          const facility = result.rows[0];
          availability = {
            facilityId: facility.id,
            availableBeds: facility.available_beds || 0,
            totalBeds: facility.total_beds || 0,
            waitingListCount: facility.waiting_list_count || 0,
            lastUpdated: facility.last_updated,
            status: facility.status,
            occupancyRate: facility.total_beds > 0 ? 
              ((facility.total_beds - (facility.available_beds || 0)) / facility.total_beds * 100).toFixed(1) : 0
          };

          // Cache the result
          this.availabilityCache.set(facilityId, availability);
          await this.cacheAvailabilityInRedis(facilityId, availability);
        }
      }

      return availability;
    } catch (error) {
      this.logger.error(`Failed to get availability for facility ${facilityId}:`, error);
      return null;
    }
  }

  async getAvailableFacilities(limit = 50) {
    try {
      // Get facilities with available beds from sorted set
      const availableFacilityIds = await this.redis.zRevRangeByScore(
        'availability:by_beds',
        '+inf',
        '1',
        { LIMIT: { offset: 0, count: limit } }
      );

      const facilities = [];
      for (const facilityId of availableFacilityIds) {
        const availability = await this.getFacilityAvailability(facilityId);
        if (availability) {
          facilities.push(availability);
        }
      }

      return facilities;
    } catch (error) {
      this.logger.error('Failed to get available facilities:', error);
      return [];
    }
  }

  async getFacilitiesByOccupancyRange(minOccupancy = 0, maxOccupancy = 100, limit = 50) {
    try {
      const facilityIds = await this.redis.zRangeByScore(
        'availability:by_occupancy',
        minOccupancy,
        maxOccupancy,
        { LIMIT: { offset: 0, count: limit } }
      );

      const facilities = [];
      for (const facilityId of facilityIds) {
        const availability = await this.getFacilityAvailability(facilityId);
        if (availability) {
          facilities.push(availability);
        }
      }

      return facilities;
    } catch (error) {
      this.logger.error('Failed to get facilities by occupancy range:', error);
      return [];
    }
  }

  // Utility methods

  getAvailabilityStats() {
    const stats = {
      totalFacilities: this.availabilityCache.size,
      availableFacilities: 0,
      unavailableFacilities: 0,
      totalBeds: 0,
      availableBeds: 0,
      averageOccupancyRate: 0
    };

    let totalOccupancy = 0;

    for (const availability of this.availabilityCache.values()) {
      stats.totalBeds += availability.totalBeds;
      stats.availableBeds += availability.availableBeds;

      if (availability.availableBeds > 0) {
        stats.availableFacilities++;
      } else {
        stats.unavailableFacilities++;
      }

      totalOccupancy += parseFloat(availability.occupancyRate);
    }

    if (stats.totalFacilities > 0) {
      stats.averageOccupancyRate = (totalOccupancy / stats.totalFacilities).toFixed(1);
    }

    return stats;
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.pgPool) {
      await this.pgPool.end();
    }

    this.logger.info('AvailabilityService stopped');
  }
}

module.exports = AvailabilityService;