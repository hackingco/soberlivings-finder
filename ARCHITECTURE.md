# Sober Living Facility Management System Architecture

## Executive Summary

This architecture leverages WordPress as the administrative control plane for facility management while maintaining a high-performance, real-time bed availability engine through the soberlivings.com API. The system provides a seamless integration between content management capabilities and real-time operational data.

## System Overview

```mermaid
graph TB
    subgraph "Control Plane - WordPress"
        WP[WordPress Admin]
        WPP[WP Plugin]
        WPD[WP Database]
        WPC[WP Cache]
    end
    
    subgraph "Real-Time Engine"
        API[SoberLivings API]
        WS[WebSocket Server]
        RTD[Real-Time Database]
        EQ[Event Queue]
    end
    
    subgraph "Data Layer"
        PG[PostgreSQL]
        RD[Redis Cache]
        ES[Elasticsearch]
    end
    
    subgraph "Client Applications"
        WEB[Web App]
        MOB[Mobile App]
        PRT[Partner Portal]
    end
    
    WP --> WPP
    WPP --> API
    API --> PG
    API --> RD
    API --> ES
    WS --> RTD
    WS --> EQ
    EQ --> API
    WEB --> API
    WEB --> WS
    MOB --> API
    MOB --> WS
    PRT --> WPP
```

## Architecture Components

### 1. Control Plane (WordPress)

**Purpose**: Administrative interface for facility management, content control, and business operations.

**Components**:
- **WordPress Core**: Content management, user authentication, role-based access
- **Sober Living Portal Plugin**: Custom functionality for facility management
- **Admin Dashboard**: Unified control interface
- **Webhook System**: Event notifications to API

**Responsibilities**:
- Facility onboarding and profile management
- Staff user management and permissions
- Content publishing (descriptions, photos, amenities)
- Pricing and availability rules
- Reporting and analytics dashboard
- Partner/affiliate management

### 2. Real-Time Bed Availability Engine

**Purpose**: High-performance, real-time tracking of bed availability across all facilities.

**Components**:
- **Availability Service**: Core availability logic
- **WebSocket Server**: Real-time updates to clients
- **Event Stream**: Availability change events
- **Cache Layer**: Sub-millisecond response times

**Data Flow**:
```
Facility Update → Event Queue → Availability Service → WebSocket Broadcast → Clients
```

### 3. API Integration Layer

**Purpose**: Bridge between WordPress control plane and real-time engine.

**Endpoints**:

#### Facility Management
- `POST /api/v1/facilities/sync` - Sync facility from WordPress
- `PUT /api/v1/facilities/{id}/availability` - Update availability
- `GET /api/v1/facilities/{id}/availability/realtime` - Real-time availability stream

#### Bed Management
- `POST /api/v1/facilities/{id}/beds` - Add/remove beds
- `PUT /api/v1/facilities/{id}/beds/{bedId}/status` - Update bed status
- `GET /api/v1/facilities/{id}/beds/availability` - Get current availability

#### Reservation System
- `POST /api/v1/reservations` - Create reservation
- `PUT /api/v1/reservations/{id}/status` - Update reservation
- `GET /api/v1/reservations/pending` - Get pending reservations

## Database Schema

### PostgreSQL (Primary Database)

```sql
-- Facilities table (source of truth)
CREATE TABLE facilities (
    id UUID PRIMARY KEY,
    wordpress_id VARCHAR(100) UNIQUE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Beds table
CREATE TABLE beds (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities(id),
    room_number VARCHAR(50),
    bed_number VARCHAR(50),
    bed_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'available',
    price_per_month DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Availability snapshots
CREATE TABLE availability_snapshots (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities(id),
    snapshot_time TIMESTAMP DEFAULT NOW(),
    total_beds INTEGER,
    available_beds INTEGER,
    occupied_beds INTEGER,
    reserved_beds INTEGER,
    maintenance_beds INTEGER,
    availability_rate DECIMAL(5,2)
);

-- Reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities(id),
    bed_id UUID REFERENCES beds(id),
    resident_name VARCHAR(200),
    resident_email VARCHAR(200),
    resident_phone VARCHAR(50),
    check_in_date DATE,
    check_out_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-time availability events
CREATE TABLE availability_events (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities(id),
    bed_id UUID REFERENCES beds(id),
    event_type VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    triggered_by VARCHAR(100),
    event_time TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);
```

### Redis Cache Structure

```redis
# Facility availability cache
facility:availability:{facility_id} = {
    "total_beds": 20,
    "available": 5,
    "occupied": 12,
    "reserved": 2,
    "maintenance": 1,
    "last_updated": "2024-08-30T12:00:00Z"
}

# Real-time subscribers
realtime:subscribers:{facility_id} = SET of WebSocket connection IDs

# Availability rules
facility:rules:{facility_id} = {
    "min_stay_days": 30,
    "max_stay_days": 365,
    "advance_booking_days": 60,
    "blackout_dates": [],
    "pricing_rules": {}
}
```

## Event-Driven Architecture

### Event Types

```typescript
enum AvailabilityEventType {
    BED_AVAILABLE = 'bed.available',
    BED_OCCUPIED = 'bed.occupied',
    BED_RESERVED = 'bed.reserved',
    BED_MAINTENANCE = 'bed.maintenance',
    FACILITY_FULL = 'facility.full',
    FACILITY_AVAILABLE = 'facility.available',
    RESERVATION_CREATED = 'reservation.created',
    RESERVATION_CONFIRMED = 'reservation.confirmed',
    RESERVATION_CANCELLED = 'reservation.cancelled',
    RESIDENT_CHECKED_IN = 'resident.checked_in',
    RESIDENT_CHECKED_OUT = 'resident.checked_out'
}
```

### Event Flow

```mermaid
sequenceDiagram
    participant WP as WordPress
    participant API as API Gateway
    participant EQ as Event Queue
    participant AS as Availability Service
    participant WS as WebSocket Server
    participant Client as Client Apps

    WP->>API: Update Bed Status
    API->>EQ: Publish Event
    EQ->>AS: Process Event
    AS->>AS: Update Availability
    AS->>WS: Broadcast Update
    WS->>Client: Push Real-time Update
```

## WordPress Plugin Architecture

### Plugin Structure

```
sober-living-portal/
├── admin/                      # Admin interface
│   ├── facility-manager.php    # Facility CRUD
│   ├── bed-manager.php         # Bed management
│   ├── availability-dashboard.php # Real-time dashboard
│   └── reports.php             # Analytics & reports
├── api/                        # API integration
│   ├── client.php              # API client
│   ├── webhooks.php            # Webhook handlers
│   └── sync.php                # Data synchronization
├── realtime/                   # Real-time features
│   ├── websocket-client.php    # WebSocket connection
│   ├── availability-widget.php # Live availability widget
│   └── notifications.php       # Push notifications
└── includes/                   # Core functionality
    ├── cron-jobs.php           # Scheduled tasks
    ├── cache-manager.php       # Caching logic
    └── data-validator.php      # Data validation
```

### WordPress Control Features

1. **Facility Management**
   - Create/Edit/Delete facilities
   - Manage facility metadata
   - Upload images and virtual tours
   - Set operating hours and rules

2. **Bed Management**
   - Add/Remove beds
   - Set bed types and pricing
   - Manage room configurations
   - Bulk status updates

3. **Availability Control**
   - Real-time availability dashboard
   - Manual override capabilities
   - Blackout date management
   - Seasonal pricing rules

4. **Reservation Management**
   - View pending reservations
   - Approve/Reject applications
   - Waitlist management
   - Check-in/Check-out processing

5. **Reporting & Analytics**
   - Occupancy reports
   - Revenue analytics
   - Resident demographics
   - Facility performance metrics

## API Specification

### Authentication

```http
POST /api/v1/auth/wordpress
Content-Type: application/json

{
    "site_url": "https://wordpress.soberlivings.com",
    "api_key": "{{WP_API_KEY}}",
    "api_secret": "{{WP_API_SECRET}}"
}

Response:
{
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
}
```

### Facility Sync

```http
POST /api/v1/facilities/sync
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "wordpress_id": "123",
    "facility_data": {
        "name": "Serenity House",
        "address": "123 Recovery Lane",
        "city": "Los Angeles",
        "state": "CA",
        "beds": [
            {
                "room": "101",
                "bed": "A",
                "type": "single",
                "price": 800
            }
        ]
    }
}
```

### Real-Time Availability WebSocket

```javascript
// Client connection
const ws = new WebSocket('wss://api.soberlivings.com/realtime');

ws.on('open', () => {
    // Subscribe to facility updates
    ws.send(JSON.stringify({
        action: 'subscribe',
        facility_id: 'facility-123',
        auth_token: 'jwt_token'
    }));
});

ws.on('message', (data) => {
    const update = JSON.parse(data);
    // Handle real-time availability update
    console.log('Availability Update:', update);
});
```

## Deployment Architecture

### Docker Compose Stack

```yaml
version: '3.8'

services:
  # WordPress Control Plane
  wordpress:
    image: wordpress:6.5-php8.2-apache
    environment:
      WORDPRESS_DB_HOST: wp-db
      SOBER_API_ENDPOINT: http://api:3000
    volumes:
      - ./wordpress-plugin:/var/www/html/wp-content/plugins/sober-living-portal
    depends_on:
      - wp-db
      - api

  wp-db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: ${WP_DB_PASSWORD}

  # API Services
  api:
    image: soberlivings/api:latest
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/soberlivings
      REDIS_URL: redis://redis:6379
      WP_WEBHOOK_SECRET: ${WP_WEBHOOK_SECRET}
    depends_on:
      - postgres
      - redis

  # WebSocket Server
  websocket:
    image: soberlivings/websocket:latest
    environment:
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"

  # Databases
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: soberlivings
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  # Monitoring
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

## Security Considerations

### Authentication & Authorization
- WordPress admin authentication for control plane
- JWT tokens for API access
- API key rotation every 90 days
- Role-based access control (RBAC)

### Data Protection
- Encryption at rest for sensitive data
- TLS 1.3 for all API communications
- PII data masking in logs
- GDPR/HIPAA compliance measures

### Rate Limiting
- API rate limits per facility
- WebSocket connection limits
- DDoS protection via Cloudflare

## Monitoring & Observability

### Key Metrics
- Bed occupancy rate
- Availability query response time
- WebSocket connection count
- API request latency
- Database query performance

### Alerting Rules
- Facility at 90% capacity
- Availability service downtime
- Database connection pool exhaustion
- API error rate > 1%
- WebSocket server memory > 80%

## Scaling Strategy

### Horizontal Scaling
- API servers: Auto-scale based on CPU/memory
- WebSocket servers: Scale based on connection count
- Database: Read replicas for queries
- Cache: Redis cluster for high availability

### Performance Targets
- API response time: < 100ms p95
- WebSocket latency: < 50ms
- Availability updates: < 500ms end-to-end
- System uptime: 99.9% SLA

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up WordPress plugin structure
- [ ] Implement basic API client
- [ ] Create facility sync mechanism
- [ ] Database schema implementation

### Phase 2: Real-Time Engine (Week 3-4)
- [ ] WebSocket server setup
- [ ] Real-time availability service
- [ ] Event queue implementation
- [ ] Cache layer optimization

### Phase 3: Integration (Week 5-6)
- [ ] WordPress admin interface
- [ ] Bed management features
- [ ] Reservation system
- [ ] Reporting dashboard

### Phase 4: Production (Week 7-8)
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Monitoring setup
- [ ] Documentation and training

## Success Metrics

- **Availability Accuracy**: 99.9% real-time accuracy
- **System Performance**: < 100ms API response time
- **User Adoption**: 80% facilities using WordPress control
- **Operational Efficiency**: 50% reduction in manual updates
- **Revenue Impact**: 20% increase in successful placements