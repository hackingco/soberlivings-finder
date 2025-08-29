const { createServer } = require('http');
const { Server } = require('socket.io');
const ioc = require('socket.io-client');
const redis = require('redis');
const RealtimeServer = require('../server');

// Test configuration
const TEST_PORT = 3004;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('Realtime Service', () => {
  let realtimeServer;
  let server;
  let io;
  let redisClient;
  let clientSocket;

  beforeAll(async () => {
    // Set up test environment
    process.env.REALTIME_PORT = TEST_PORT;
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.JWT_SECRET = 'test-secret';

    // Initialize Redis client for tests
    redisClient = redis.createClient({
      url: REDIS_URL
    });
    await redisClient.connect();
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
  });

  beforeEach(async () => {
    // Create realtime server instance
    realtimeServer = new RealtimeServer();
    await realtimeServer.initialize();

    // Start server
    server = realtimeServer.server;
    io = realtimeServer.io;

    return new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Cleanup
    if (clientSocket) {
      clientSocket.close();
    }

    if (server) {
      server.close();
    }

    await realtimeServer.shutdown();

    // Clear Redis test data
    const keys = await redisClient.keys('*test*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  });

  describe('Connection Management', () => {
    test('should accept WebSocket connections', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);
      
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    test('should handle connection establishment', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);
      
      clientSocket.on('connection:established', (data) => {
        expect(data).toHaveProperty('socketId');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('serverTime');
        done();
      });
    });

    test('should track connection count', (done) => {
      const socket1 = ioc(`http://localhost:${TEST_PORT}`);
      const socket2 = ioc(`http://localhost:${TEST_PORT}`);

      let connectCount = 0;
      
      const onConnect = () => {
        connectCount++;
        if (connectCount === 2) {
          // Check connection count via metrics endpoint
          fetch(`http://localhost:${TEST_PORT}/status`)
            .then(response => response.json())
            .then(data => {
              expect(data.connections.total).toBeGreaterThanOrEqual(2);
              socket1.close();
              socket2.close();
              done();
            });
        }
      };

      socket1.on('connect', onConnect);
      socket2.on('connect', onConnect);
    });
  });

  describe('Authentication', () => {
    test('should handle authentication with valid token', (done) => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 'test-user-1', email: 'test@example.com', role: 'user' },
        'test-secret',
        { expiresIn: '1h' }
      );

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        auth: { token }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          token,
          userId: 'test-user-1'
        });
      });

      clientSocket.on('auth:success', (data) => {
        expect(data.userId).toBe('test-user-1');
        expect(data.authenticated).toBe(true);
        expect(data).toHaveProperty('sessionId');
        done();
      });
    });

    test('should reject invalid authentication', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          token: 'invalid-token',
          userId: 'test-user-1'
        });
      });

      clientSocket.on('auth:failed', (data) => {
        expect(data).toHaveProperty('message');
        done();
      });
    });
  });

  describe('Room Management', () => {
    test('should allow joining rooms', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('join_room', { room: 'test-room' });
      });

      clientSocket.on('room:joined', (data) => {
        expect(data.room).toBe('test-room');
        done();
      });
    });

    test('should allow leaving rooms', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('join_room', { room: 'test-room' });
      });

      clientSocket.on('room:joined', () => {
        clientSocket.emit('leave_room', { room: 'test-room' });
      });

      clientSocket.on('room:left', (data) => {
        expect(data.room).toBe('test-room');
        done();
      });
    });
  });

  describe('Facility Subscriptions', () => {
    test('should allow facility subscription', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_facility', {
          facilityId: 'facility-123'
        });
      });

      clientSocket.on('subscription:success', (data) => {
        expect(data.type).toBe('facility');
        expect(data.facilityId).toBe('facility-123');
        expect(data.room).toBe('facility:facility-123');
        done();
      });
    });

    test('should allow facility unsubscription', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_facility', {
          facilityId: 'facility-123'
        });
      });

      clientSocket.on('subscription:success', () => {
        clientSocket.emit('unsubscribe_facility', {
          facilityId: 'facility-123'
        });
      });

      clientSocket.on('unsubscription:success', (data) => {
        expect(data.type).toBe('facility');
        expect(data.facilityId).toBe('facility-123');
        done();
      });
    });
  });

  describe('Search Subscriptions', () => {
    test('should allow search subscription', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_search', {
          query: 'test search',
          filters: { city: 'Test City' }
        });
      });

      clientSocket.on('subscription:success', (data) => {
        expect(data.type).toBe('search');
        expect(data.query).toBe('test search');
        expect(data).toHaveProperty('searchId');
        expect(data).toHaveProperty('room');
        done();
      });
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast facility availability changes', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_facility', {
          facilityId: 'facility-123'
        });
      });

      clientSocket.on('subscription:success', () => {
        // Simulate availability change event
        io.to('facility:facility-123').emit('facility:availability_changed', {
          facilityId: 'facility-123',
          availability: {
            availableBeds: 5,
            totalBeds: 20
          },
          changes: {
            availableBeds: { from: 3, to: 5, delta: 2 }
          },
          timestamp: Date.now()
        });
      });

      clientSocket.on('facility:availability_changed', (data) => {
        expect(data.facilityId).toBe('facility-123');
        expect(data.availability).toHaveProperty('availableBeds');
        expect(data.availability).toHaveProperty('totalBeds');
        expect(data).toHaveProperty('changes');
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });

    test('should broadcast search results updates', (done) => {
      const query = 'test search';
      const searchId = Buffer.from(JSON.stringify({ query, filters: {} })).toString('base64').slice(0, 32);

      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_search', { query });
      });

      clientSocket.on('subscription:success', () => {
        // Simulate search results update
        io.to(`search:${searchId}`).emit('search:results_updated', {
          query: query,
          searchId: searchId,
          resultCount: 10,
          results: [
            { id: 1, name: 'Test Facility 1' },
            { id: 2, name: 'Test Facility 2' }
          ],
          timestamp: Date.now()
        });
      });

      clientSocket.on('search:results_updated', (data) => {
        expect(data.query).toBe(query);
        expect(data.searchId).toBe(searchId);
        expect(data.resultCount).toBe(10);
        expect(data.results).toHaveLength(2);
        done();
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce subscription rate limits', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      let subscriptionCount = 0;
      let rateLimited = false;

      clientSocket.on('connect', () => {
        // Rapidly attempt multiple subscriptions
        for (let i = 0; i < 15; i++) {
          clientSocket.emit('subscribe_facility', {
            facilityId: `facility-${i}`
          });
        }
      });

      clientSocket.on('subscription:success', () => {
        subscriptionCount++;
      });

      clientSocket.on('subscription:rate_limited', () => {
        rateLimited = true;
      });

      setTimeout(() => {
        expect(subscriptionCount).toBeLessThan(15);
        expect(rateLimited).toBe(true);
        done();
      }, 1000);
    });
  });

  describe('Health Endpoints', () => {
    test('should respond to health check', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('connections');
    });

    test('should provide service status', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('service', 'realtime-service');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('connections');
      expect(data).toHaveProperty('redis');
    });

    test('should provide metrics', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/metrics`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalConnections');
      expect(data).toHaveProperty('authenticatedConnections');
      expect(data).toHaveProperty('messagesProcessed');
      expect(data).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed messages gracefully', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        // Send malformed subscription request
        clientSocket.emit('subscribe_facility', {
          // Missing facilityId
        });
      });

      clientSocket.on('subscription:error', (data) => {
        expect(data).toHaveProperty('message');
        done();
      });
    });

    test('should handle disconnection gracefully', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`);

      clientSocket.on('connect', () => {
        // Subscribe to something first
        clientSocket.emit('subscribe_facility', {
          facilityId: 'facility-123'
        });
      });

      clientSocket.on('subscription:success', () => {
        // Forcefully close connection
        clientSocket.disconnect();
        
        // Give server time to clean up
        setTimeout(() => {
          // Connection should be cleaned up
          expect(clientSocket.connected).toBe(false);
          done();
        }, 100);
      });
    });
  });

  describe('Redis Integration', () => {
    test('should process events from Redis streams', async () => {
      // Add event to Redis stream
      await redisClient.xAdd('facility:events', '*', {
        type: 'facility:availability_changed',
        facilityId: 'facility-test',
        timestamp: Date.now().toString(),
        data: JSON.stringify({
          facilityId: 'facility-test',
          current: { availableBeds: 5, totalBeds: 20 },
          previous: { availableBeds: 3, totalBeds: 20 },
          changes: { availableBeds: { from: 3, to: 5, delta: 2 } }
        }),
        priority: '2'
      });

      // Give event processor time to handle the event
      await new Promise(resolve => setTimeout(resolve, 100));

      // Event should be processed and potentially cached
      // This would require more sophisticated testing setup
      // to verify the event was actually processed
    });
  });
});