# Sober Livings - Realtime Service

Real-time WebSocket service for facility availability tracking and live updates. Built with Socket.IO, Redis Streams, and PostgreSQL.

## 🚀 Features

- **Real-time WebSocket Connections**: Socket.IO with Redis adapter for scaling
- **Availability Tracking**: Live facility bed availability monitoring
- **Event Processing**: Redis Streams for reliable event handling
- **Authentication**: JWT-based user authentication
- **Rate Limiting**: Comprehensive rate limiting for different operations
- **Room Management**: Dynamic room subscriptions for facilities and searches
- **Broadcasting**: Priority-based event broadcasting system
- **Analytics**: Real-time metrics and performance monitoring

## 📋 Architecture

### Core Components

- **Socket Service**: WebSocket connection management and authentication
- **Availability Service**: Real-time facility availability tracking
- **Event Processor**: Redis Streams event processing and broadcasting
- **Update Handlers**: Specialized handlers for facility and search updates

### Event Flow

```
Database Changes → Redis Streams → Event Processor → Socket.IO → Clients
```

### Supported Events

#### Facility Events
- `facility:availability_changed` - Bed availability updates
- `facility:status_updated` - Facility status changes
- `facility:created` - New facility added
- `facility:updated` - Facility information updates
- `facility:deleted` - Facility removed

#### Search Events
- `search:results_updated` - Search results changes
- `search:filters_changed` - Filter updates
- `search:index_rebuilt` - Search index updates

#### System Events
- `system:maintenance_mode` - Maintenance notifications
- `system:announcement` - System announcements
- `user:presence_updated` - User presence changes

## 🛠 Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the service:**
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables

Key configuration options:

```env
# Service
REALTIME_PORT=3003
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soberlivings
DB_USER=postgres
DB_PASSWORD=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# WebSocket
WEBSOCKET_CORS_ORIGINS=http://localhost:3000
FRONTEND_URLS=http://localhost:3000

# Monitoring
AVAILABILITY_CHECK_INTERVAL=30000
```

### Rate Limiting Configuration

Built-in rate limiting for different operations:

- **General requests**: 100/minute
- **Authentication**: 5/5 minutes
- **Subscriptions**: 20/minute
- **Room changes**: 10/minute
- **Premium users**: 300/minute

## 📡 WebSocket API

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3003', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Authentication

```javascript
socket.emit('authenticate', {
  token: 'your-jwt-token',
  userId: 'user-id'
});

socket.on('auth:success', (data) => {
  console.log('Authenticated:', data);
});
```

### Facility Subscriptions

```javascript
// Subscribe to facility updates
socket.emit('subscribe_facility', {
  facilityId: 'facility-123'
});

// Listen for availability changes
socket.on('facility:availability_changed', (data) => {
  console.log('Availability changed:', data);
});
```

### Search Subscriptions

```javascript
// Subscribe to search results
socket.emit('subscribe_search', {
  query: 'sober living Los Angeles',
  filters: { city: 'Los Angeles' }
});

// Listen for result updates
socket.on('search:results_updated', (data) => {
  console.log('Search results updated:', data);
});
```

### Room Management

```javascript
// Join custom rooms
socket.emit('join_room', { room: 'notifications' });

// Leave rooms
socket.emit('leave_room', { room: 'notifications' });
```

## 🔄 Event Processing

### Redis Streams

The service uses Redis Streams for reliable event processing:

- **Facility Events**: `facility:events`
- **Search Events**: `search:events`
- **User Events**: `user:events`
- **System Events**: `system:events`

### Event Publishing

Publish events to Redis Streams:

```javascript
await redis.xAdd('facility:events', '*', {
  type: 'facility:availability_changed',
  facilityId: 'facility-123',
  data: JSON.stringify({
    facilityId: 'facility-123',
    current: { availableBeds: 5 },
    previous: { availableBeds: 3 }
  }),
  timestamp: Date.now().toString(),
  priority: '2'
});
```

## 📊 Monitoring

### Health Endpoints

- **Health Check**: `GET /health`
- **Service Status**: `GET /status`  
- **Metrics**: `GET /metrics`

### Metrics Available

```json
{
  "totalConnections": 150,
  "authenticatedConnections": 120,
  "messagesProcessed": 5420,
  "uptime": 86400000,
  "connectionsPerMinute": 2.5,
  "messagesPerMinute": 90.3,
  "currentConnections": 45,
  "activeRooms": 78
}
```

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Categories

- Connection management
- Authentication flow
- Room subscriptions
- Event broadcasting
- Rate limiting
- Error handling

## 🐳 Docker Deployment

### Development

```bash
docker build --target development -t realtime-dev .
docker run -p 3003:3003 -v $(pwd):/app realtime-dev
```

### Production

```bash
docker build --target production -t realtime-prod .
docker run -p 3003:3003 realtime-prod
```

### Docker Compose

```yaml
version: '3.8'
services:
  realtime:
    build: 
      context: .
      target: production
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
```

## 📈 Performance

### Optimization Features

- **Connection pooling**: Efficient database connections
- **Redis adapter**: Horizontal scaling across multiple instances
- **Event batching**: Efficient Redis Streams processing
- **Memory management**: Intelligent caching and cleanup
- **Rate limiting**: Protect against abuse

### Scaling Recommendations

- Use Redis Cluster for high availability
- Deploy multiple service instances behind load balancer
- Monitor memory usage and connection counts
- Implement connection limits per user/IP

## 🔐 Security

### Features

- JWT token authentication
- Role-based access control
- Rate limiting by IP/user
- Input validation
- CORS protection
- Helmet security headers

### Best Practices

- Use strong JWT secrets
- Implement proper token refresh
- Monitor for suspicious activity
- Use HTTPS in production
- Regularly update dependencies

## 🐛 Troubleshooting

### Common Issues

1. **High memory usage**
   - Check connection cleanup
   - Monitor Redis memory
   - Review rate limiting settings

2. **Slow event processing**
   - Check Redis Streams lag
   - Monitor database performance
   - Review consumer configuration

3. **Connection drops**
   - Check network stability
   - Review ping/pong configuration
   - Monitor load balancer settings

### Debug Mode

```bash
DEBUG=realtime:* npm start
```

## 📚 Integration

### With Other Services

- **Search Service**: Receives search update events
- **Geospatial Service**: Gets location change notifications  
- **Notification Service**: Sends critical alerts
- **Frontend**: Real-time UI updates

### Event Publishing Example

```javascript
const FacilityUpdateHandler = require('./src/handlers/facility-updates');

const handler = new FacilityUpdateHandler(io, redis, logger, availabilityService);

await handler.handleFacilityUpdate('facility-123', {
  available_beds: 8,
  status: 'active'
}, {
  source: 'admin-update',
  operator: 'admin-user-456'
});
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check existing documentation
- Review test examples
- Contact development team

---

**Real-time facility updates made simple and reliable.**