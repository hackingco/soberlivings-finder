const Event = require('../models/event');
const { SOCKET_EVENTS } = require('../config/socket');

class SearchUpdateHandler {
  constructor(io, redis, logger) {
    this.io = io;
    this.redis = redis;
    this.logger = logger;
    this.activeSearches = new Map(); // searchId -> search metadata
    this.searchSubscriptions = new Map(); // searchId -> Set of socketIds
  }

  async handleSearchResultsUpdate(query, results, metadata = {}) {
    try {
      this.logger.debug(`Handling search results update for query: "${query}"`);

      // Create search identifier
      const searchId = this.generateSearchId(query, metadata.filters);

      // Prepare update data
      const updateData = {
        query,
        searchId,
        resultCount: results.length,
        results: results,
        filters: metadata.filters || {},
        metadata: {
          ...metadata,
          handlerVersion: '1.0',
          processedAt: Date.now()
        }
      };

      // Create search update event
      const event = new Event('search:results_updated', updateData, {
        priority: this.calculateSearchPriority(results, metadata),
        source: 'search-update-handler',
        rooms: [`search:${searchId}`, 'authenticated_users']
      });

      // Process the search update
      await this.processSearchUpdate(event);

      // Broadcast to subscribers
      await this.broadcastSearchUpdate(event);

      // Store search analytics
      await this.storeSearchAnalytics(event);

      this.logger.info(`Successfully processed search results update: ${query} (${results.length} results)`);

    } catch (error) {
      this.logger.error(`Failed to handle search results update for query "${query}":`, error);
      throw error;
    }
  }

  async handleSearchFilterChange(filters, affectedQueries = []) {
    try {
      this.logger.debug('Handling search filter change:', filters);

      // Create filter change event
      const event = new Event('search:filters_changed', {
        filters,
        affectedQueries,
        timestamp: Date.now()
      }, {
        priority: 3, // MEDIUM
        source: 'search-update-handler',
        rooms: ['authenticated_users']
      });

      // Broadcast filter changes
      this.io.to('authenticated_users').emit(SOCKET_EVENTS.SEARCH_FILTERS_CHANGED, {
        filters,
        affectedQueries,
        timestamp: event.timestamp
      });

      // Invalidate affected searches
      await this.invalidateAffectedSearches(affectedQueries);

      this.logger.info('Successfully processed search filter change');

    } catch (error) {
      this.logger.error('Failed to handle search filter change:', error);
      throw error;
    }
  }

  async handleSearchIndexRebuild(indexInfo) {
    try {
      this.logger.info('Handling search index rebuild');

      // Notify all authenticated users
      this.io.to('authenticated_users').emit('search:index_rebuilt', {
        message: 'Search index has been updated with latest facility data',
        indexInfo: indexInfo,
        timestamp: Date.now()
      });

      // Invalidate all cached searches
      await this.invalidateAllSearchCaches();

      // Store index rebuild event
      await this.redis.xAdd('search:events', '*', {
        type: 'index_rebuilt',
        timestamp: Date.now().toString(),
        indexInfo: JSON.stringify(indexInfo),
        source: 'search-update-handler'
      });

      this.logger.info('Successfully processed search index rebuild notification');

    } catch (error) {
      this.logger.error('Failed to handle search index rebuild:', error);
      throw error;
    }
  }

  generateSearchId(query, filters = {}) {
    // Create a unique identifier for this search combination
    const searchParams = {
      query: query.toLowerCase().trim(),
      filters: this.normalizeFilters(filters)
    };

    return Buffer.from(JSON.stringify(searchParams)).toString('base64').slice(0, 32);
  }

  normalizeFilters(filters) {
    // Normalize filter object for consistent hashing
    const normalized = {};
    
    Object.keys(filters).sort().forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        if (Array.isArray(filters[key])) {
          normalized[key] = filters[key].sort();
        } else {
          normalized[key] = filters[key];
        }
      }
    });

    return normalized;
  }

  calculateSearchPriority(results, metadata) {
    // High priority for searches with no results (might indicate data issues)
    if (results.length === 0) {
      return 2; // HIGH
    }

    // High priority for searches with very few results when many were expected
    if (metadata.expectedResults && results.length < metadata.expectedResults * 0.5) {
      return 2; // HIGH
    }

    // High priority for location-based searches (users likely waiting)
    if (metadata.filters && (metadata.filters.latitude || metadata.filters.location)) {
      return 2; // HIGH
    }

    // Medium priority for filtered searches
    if (metadata.filters && Object.keys(metadata.filters).length > 0) {
      return 3; // MEDIUM
    }

    // Low priority for general searches
    return 4; // LOW
  }

  async processSearchUpdate(event) {
    const { query, searchId, results } = event.data;

    // Update active searches registry
    this.activeSearches.set(searchId, {
      query,
      lastUpdated: Date.now(),
      resultCount: results.length,
      subscribers: this.searchSubscriptions.get(searchId)?.size || 0
    });

    // Process search quality metrics
    await this.processSearchQualityMetrics(event);

    // Update search result cache
    await this.updateSearchResultCache(event);

    // Check for significant result changes
    await this.detectSignificantChanges(event);
  }

  async processSearchQualityMetrics(event) {
    try {
      const { query, results, searchId } = event.data;

      // Calculate search quality metrics
      const metrics = {
        resultCount: results.length,
        avgRelevanceScore: this.calculateAverageRelevance(results),
        locationCoverage: this.calculateLocationCoverage(results),
        priceRange: this.calculatePriceRange(results),
        availabilityRate: this.calculateAvailabilityRate(results)
      };

      // Store metrics for analysis
      await this.redis.hSet(`search_metrics:${searchId}`, {
        query,
        timestamp: Date.now().toString(),
        ...Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, v.toString()]))
      });

      // Set expiration (7 days)
      await this.redis.expire(`search_metrics:${searchId}`, 7 * 24 * 60 * 60);

      event.data.qualityMetrics = metrics;

    } catch (error) {
      this.logger.error('Failed to process search quality metrics:', error);
    }
  }

  calculateAverageRelevance(results) {
    if (!results.length) return 0;
    
    const totalScore = results.reduce((sum, result) => {
      return sum + (result.relevanceScore || 0);
    }, 0);

    return (totalScore / results.length).toFixed(2);
  }

  calculateLocationCoverage(results) {
    const uniqueLocations = new Set();
    
    results.forEach(result => {
      if (result.city && result.state) {
        uniqueLocations.add(`${result.city}, ${result.state}`);
      }
    });

    return uniqueLocations.size;
  }

  calculatePriceRange(results) {
    const prices = results
      .map(r => r.monthlyRate || r.monthly_rate)
      .filter(p => p && p > 0);

    if (!prices.length) return { min: 0, max: 0, avg: 0 };

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
    };
  }

  calculateAvailabilityRate(results) {
    if (!results.length) return 0;

    const availableCount = results.filter(r => (r.availableBeds || r.available_beds || 0) > 0).length;
    return ((availableCount / results.length) * 100).toFixed(1);
  }

  async updateSearchResultCache(event) {
    try {
      const { searchId, results, query, filters } = event.data;

      // Cache search results
      const cacheKey = `search_cache:${searchId}`;
      const cacheData = {
        query,
        filters,
        results,
        cachedAt: Date.now(),
        resultCount: results.length
      };

      await this.redis.setEx(cacheKey, 300, JSON.stringify(cacheData)); // 5 minutes TTL

      // Update search result count in sorted set for analytics
      await this.redis.zAdd('search_results_count', [
        { score: results.length, value: searchId }
      ]);

    } catch (error) {
      this.logger.error('Failed to update search result cache:', error);
    }
  }

  async detectSignificantChanges(event) {
    try {
      const { searchId, results } = event.data;

      // Get previous result count
      const prevCacheKey = `search_cache:${searchId}`;
      const prevCached = await this.redis.get(prevCacheKey);

      if (prevCached) {
        const prevData = JSON.parse(prevCached);
        const prevCount = prevData.resultCount;
        const currentCount = results.length;

        // Detect significant changes (>20% change or >10 result difference)
        const percentChange = prevCount > 0 ? Math.abs(currentCount - prevCount) / prevCount : 0;
        const absoluteChange = Math.abs(currentCount - prevCount);

        if (percentChange > 0.2 || absoluteChange > 10) {
          await this.notifySignificantSearchChange(event, prevCount, currentCount);
        }
      }

    } catch (error) {
      this.logger.error('Failed to detect significant search changes:', error);
    }
  }

  async notifySignificantSearchChange(event, prevCount, currentCount) {
    try {
      const { query, searchId } = event.data;

      // Notify subscribers about significant changes
      this.io.to(`search:${searchId}`).emit('search:significant_change', {
        query,
        searchId,
        previousCount: prevCount,
        currentCount: currentCount,
        change: currentCount - prevCount,
        timestamp: Date.now()
      });

      this.logger.info(`Significant search change detected: "${query}" (${prevCount} → ${currentCount})`);

    } catch (error) {
      this.logger.error('Failed to notify significant search change:', error);
    }
  }

  async broadcastSearchUpdate(event) {
    const { query, searchId, results, qualityMetrics } = event.data;

    // Broadcast to search-specific subscribers
    this.io.to(`search:${searchId}`).emit(SOCKET_EVENTS.SEARCH_RESULTS_UPDATED, {
      query,
      searchId,
      resultCount: results.length,
      results: this.sanitizeResultsForBroadcast(results),
      qualityMetrics,
      timestamp: event.timestamp
    });

    // Broadcast high-priority updates to wider audience
    if (event.priority <= 2) { // CRITICAL or HIGH
      this.io.to('authenticated_users').emit('search:priority_update', {
        query,
        resultCount: results.length,
        priority: event.priority,
        timestamp: event.timestamp
      });
    }

    this.logger.debug(`Broadcasted search update for: "${query}" to search:${searchId}`);
  }

  sanitizeResultsForBroadcast(results) {
    // Limit results for real-time broadcast and remove sensitive data
    return results.slice(0, 20).map(result => ({
      id: result.id,
      name: result.name,
      city: result.city,
      state: result.state,
      availableBeds: result.availableBeds || result.available_beds,
      monthlyRate: result.monthlyRate || result.monthly_rate,
      relevanceScore: result.relevanceScore
    }));
  }

  async invalidateAffectedSearches(queries) {
    try {
      for (const query of queries) {
        const pattern = `search_cache:*`;
        const keys = await this.redis.keys(pattern);

        for (const key of keys) {
          try {
            const cached = await this.redis.get(key);
            if (cached) {
              const data = JSON.parse(cached);
              if (data.query === query) {
                await this.redis.del(key);
                this.logger.debug(`Invalidated cache for query: "${query}"`);
              }
            }
          } catch (parseError) {
            // Skip malformed cache entries
            continue;
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate affected searches:', error);
    }
  }

  async invalidateAllSearchCaches() {
    try {
      const pattern = 'search_cache:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info(`Invalidated ${keys.length} search cache entries`);
      }

      // Clear search metrics as well
      const metricsPattern = 'search_metrics:*';
      const metricsKeys = await this.redis.keys(metricsPattern);
      
      if (metricsKeys.length > 0) {
        await this.redis.del(metricsKeys);
        this.logger.info(`Cleared ${metricsKeys.length} search metrics entries`);
      }

    } catch (error) {
      this.logger.error('Failed to invalidate all search caches:', error);
    }
  }

  async storeSearchAnalytics(event) {
    try {
      const { query, searchId, results, qualityMetrics } = event.data;

      // Store analytics event
      await this.redis.xAdd('search:analytics', '*', {
        type: 'results_updated',
        query,
        searchId,
        resultCount: results.length.toString(),
        timestamp: event.timestamp.toString(),
        qualityMetrics: JSON.stringify(qualityMetrics || {}),
        source: 'search-update-handler'
      });

      // Update search frequency counter
      await this.redis.incr(`search_frequency:${searchId}`);

    } catch (error) {
      this.logger.error('Failed to store search analytics:', error);
    }
  }

  // Public API methods

  registerSearchSubscription(socketId, searchId) {
    if (!this.searchSubscriptions.has(searchId)) {
      this.searchSubscriptions.set(searchId, new Set());
    }
    this.searchSubscriptions.get(searchId).add(socketId);
  }

  unregisterSearchSubscription(socketId, searchId) {
    if (this.searchSubscriptions.has(searchId)) {
      this.searchSubscriptions.get(searchId).delete(socketId);
      
      // Clean up empty subscription sets
      if (this.searchSubscriptions.get(searchId).size === 0) {
        this.searchSubscriptions.delete(searchId);
      }
    }
  }

  async getActiveSearches() {
    return Array.from(this.activeSearches.entries()).map(([searchId, data]) => ({
      searchId,
      ...data
    }));
  }

  async getSearchAnalytics(searchId) {
    try {
      const metrics = await this.redis.hGetAll(`search_metrics:${searchId}`);
      const frequency = await this.redis.get(`search_frequency:${searchId}`);
      
      return {
        searchId,
        ...metrics,
        frequency: parseInt(frequency) || 0
      };
    } catch (error) {
      this.logger.error(`Failed to get search analytics for ${searchId}:`, error);
      return null;
    }
  }

  getSearchStats() {
    return {
      activeSearches: this.activeSearches.size,
      totalSubscriptions: Array.from(this.searchSubscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      searchesByQuery: Array.from(this.activeSearches.values())
        .reduce((acc, search) => {
          acc[search.query] = (acc[search.query] || 0) + 1;
          return acc;
        }, {})
    };
  }
}

module.exports = SearchUpdateHandler;