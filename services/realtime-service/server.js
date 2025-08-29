const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
require('dotenv').config();

const SocketService = require('./src/services/socket-service');
const AvailabilityService = require('./src/services/availability-service');
const EventProcessor = require('./src/services/event-processor');
const authMiddleware = require('./src/middleware/auth');
const rateLimitMiddleware = require('./src/middleware/rate-limiting');

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'realtime-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class RealtimeServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.port = process.env.REALTIME_PORT || 3003;
    this.redisClient = null;
    this.io = null;
    this.socketService = null;
    this.availabilityService = null;
    this.eventProcessor = null;
  }

  async initialize() {
    try {
      // Setup Express middleware
      this.setupMiddleware();
      
      // Initialize Redis connections
      await this.initializeRedis();
      
      // Initialize Socket.IO
      this.initializeSocketIO();
      
      // Initialize services
      await this.initializeServices();
      
      // Setup routes
      this.setupRoutes();
      
      logger.info('Realtime server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize realtime server:', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URLS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    this.app.use(express.json());
    this.app.use(rateLimitMiddleware);
  }

  async initializeRedis() {
    // Redis client for general operations
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    await this.redisClient.connect();

    // Redis adapter client for Socket.IO
    const pubClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD
    });
    
    const subClient = pubClient.duplicate();
    
    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    this.redisAdapter = createAdapter(pubClient, subClient);
    
    logger.info('Redis adapter initialized');
  }

  initializeSocketIO() {
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URLS?.split(',') || ['http://localhost:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Use Redis adapter for scaling
    this.io.adapter(this.redisAdapter);

    // Authentication middleware for Socket.IO
    this.io.use(authMiddleware);

    logger.info('Socket.IO initialized with Redis adapter');
  }

  async initializeServices() {
    this.socketService = new SocketService(this.io, this.redisClient, logger);
    this.availabilityService = new AvailabilityService(this.redisClient, logger);
    this.eventProcessor = new EventProcessor(this.redisClient, this.io, logger);

    await this.socketService.initialize();
    await this.availabilityService.initialize();
    await this.eventProcessor.initialize();

    logger.info('All services initialized');
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connections: this.io.engine.clientsCount
      });
    });

    // Service status
    this.app.get('/status', (req, res) => {
      res.json({
        service: 'realtime-service',
        version: '1.0.0',
        connections: {
          total: this.io.engine.clientsCount,
          authenticated: this.socketService.getAuthenticatedCount()
        },
        redis: {
          connected: this.redisClient.isReady
        }
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.socketService.getMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });
  }

  async start() {
    try {
      await this.initialize();
      
      this.server.listen(this.port, () => {
        logger.info(`Realtime service listening on port ${this.port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start realtime server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down realtime server...');
    
    try {
      if (this.eventProcessor) {
        await this.eventProcessor.stop();
      }
      
      if (this.io) {
        this.io.close();
      }
      
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      this.server.close(() => {
        logger.info('Realtime server shut down successfully');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new RealtimeServer();
  server.start();
}

module.exports = RealtimeServer;