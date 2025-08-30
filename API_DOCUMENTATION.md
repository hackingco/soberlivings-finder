# SoberLivings API Documentation

Complete API reference for the SoberLivings platform with facility search, geospatial queries, and administrative operations.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Public API Endpoints](#public-api-endpoints)
5. [Admin API Endpoints](#admin-api-endpoints)
6. [Geospatial API Endpoints](#geospatial-api-endpoints)
7. [Health & Monitoring](#health--monitoring)
8. [Webhooks](#webhooks)
9. [ETL Pipeline](#etl-pipeline)
10. [Error Handling](#error-handling)
11. [Examples](#examples)

## Overview

The SoberLivings API provides comprehensive access to sober living and treatment facility data across the United States. Built with Next.js 14, TypeScript, and PostgreSQL for high performance and reliability.

### Base URLs

- **Production**: `https://api.soberlivings.com`
- **Staging**: `https://staging-api.soberlivings.com`
- **Development**: `http://localhost:3000`

### API Version

Current API version: **v1**

All endpoints are prefixed with `/api/v1/` unless otherwise noted.

## Authentication

### API Key Authentication

```bash
curl -H "X-API-Key: your-api-key" https://api.soberlivings.com/api/v1/admin/facilities
```

### JWT Bearer Token

```bash
curl -H "Authorization: Bearer your-jwt-token" https://api.soberlivings.com/api/v1/admin/facilities
```

### Public Endpoints

Most search endpoints are publicly accessible without authentication.

## Rate Limiting

| User Type | Requests per Minute | Burst Limit |
|-----------|-------------------|-------------|
| Anonymous | 100 | 150 |
| Authenticated | 1000 | 1500 |
| Premium | 5000 | 7500 |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when rate limit resets

## Public API Endpoints

### Facility Search

#### GET /api/facilities/search

Search for facilities with advanced filtering.

**Parameters:**
- `q` (string): General search query
- `location` (string): City, state, or "lat,lng" coordinates
- `services` (string[]): Filter by services (residential, outpatient, detox, etc.)
- `insurance` (string[]): Filter by accepted insurance types
- `radius` (number): Search radius in miles (default: 25)
- `limit` (number): Results per page (max 100, default 50)
- `offset` (number): Pagination offset (default 0)
- `sort` (string): Sort by 'name', 'distance', 'rating' (default: verified desc, name asc)

**Response:**
```json
{
  "success": true,
  "facilities": [
    {
      "id": "uuid-here",
      "name": "Example Recovery Center",
      "street": "123 Recovery St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "phone": "(555) 123-4567",
      "website": "https://example.com",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "services": ["residential", "outpatient", "detox"],
      "description": "Comprehensive recovery services...",
      "amenities": ["private rooms", "gym", "kitchen"],
      "acceptedInsurance": ["Medicare", "Medicaid", "Private"],
      "verified": true,
      "lastVerified": "2024-01-15T10:30:00Z",
      "rating": 4.5,
      "reviewCount": 42
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "pages": 25,
    "currentPage": 1
  },
  "filters": {
    "location": "San Francisco, CA",
    "services": ["residential"],
    "insurance": ["Medicare"]
  },
  "meta": {
    "searchRadius": 25,
    "searchCenter": {
      "lat": 37.7749,
      "lng": -122.4194
    },
    "executionTime": "127ms"
  }
}
```

**Example Requests:**

```bash
# Basic search
GET /api/facilities/search?location=Los%20Angeles,%20CA

# Service-specific search
GET /api/facilities/search?services=residential&services=detox

# Complex search with multiple filters
GET /api/facilities/search?location=New%20York,%20NY&services=outpatient&insurance=Medicare&radius=50&limit=20
```

#### GET /api/facilities/search (Edge Route)

High-performance edge-cached search endpoint for common queries.

**Features:**
- Edge caching for common searches
- Reduced latency (< 100ms globally)
- Limited to basic search parameters

### Facility Details

#### GET /api/v1/facilities/{id}

Get detailed information about a specific facility.

**Parameters:**
- `id` (uuid): Facility UUID

**Response:**
```json
{
  "success": true,
  "facility": {
    "id": "uuid-here",
    "name": "Example Recovery Center",
    "street": "123 Recovery St",
    "city": "San Francisco", 
    "state": "CA",
    "zip": "94102",
    "phone": "(555) 123-4567",
    "website": "https://example.com",
    "email": "info@example.com",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "services": ["residential", "outpatient", "detox"],
    "description": "Comprehensive recovery services with 24/7 support...",
    "amenities": ["private rooms", "gym", "kitchen", "garden"],
    "acceptedInsurance": ["Medicare", "Medicaid", "Private", "Aetna"],
    "verified": true,
    "lastVerified": "2024-01-15T10:30:00Z",
    "rating": 4.5,
    "reviewCount": 42,
    "capacity": 48,
    "availability": "available",
    "photos": [
      {
        "url": "https://example.com/photo1.jpg",
        "caption": "Main building exterior",
        "alt": "Example Recovery Center main building"
      }
    ],
    "operatingHours": {
      "monday": "24/7",
      "tuesday": "24/7",
      "admissions": "Mon-Fri 9AM-5PM"
    },
    "certifications": ["JCAHO", "CARF"],
    "treatmentApproaches": ["12-step", "CBT", "DBT", "holistic"],
    "specialties": ["dual-diagnosis", "trauma", "PTSD"],
    "ageGroups": ["adults", "young-adults"],
    "gender": "all",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Data Import

#### POST /api/facilities/import

Import facility data from external sources (requires authentication).

**Request Body:**
```json
{
  "source": "findtreatment.gov",
  "location": "Los Angeles, CA",
  "radius": 50,
  "filters": {
    "residential": true,
    "insurance": ["Medicare", "Medicaid"]
  }
}
```

## Admin API Endpoints

All admin endpoints require authentication and appropriate permissions.

### Facility Management

#### GET /api/v1/admin/facilities

List and manage facilities with advanced filtering and admin-only fields.

**Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 50, max: 200)
- `status` (string): Filter by verification status
- `verified` (boolean): Filter by verification status
- `operator` (uuid): Filter by operator ID
- `sort` (string): Sort field and direction

**Response includes admin-only fields:**
```json
{
  "success": true,
  "facilities": [
    {
      "id": "uuid-here",
      "name": "Example Recovery Center",
      "status": "active",
      "verificationStatus": "verified",
      "operatorId": "operator-uuid",
      "revenue": 125000,
      "occupancyRate": 0.85,
      "lastContact": "2024-01-15T10:30:00Z",
      "notes": "Premium partner facility",
      "internalRating": 4.8,
      "complianceScore": 95,
      "// ... other fields": "..."
    }
  ],
  "pagination": {
    "// pagination fields": "..."
  },
  "stats": {
    "totalFacilities": 12500,
    "verifiedFacilities": 8200,
    "pendingVerification": 145,
    "averageOccupancy": 0.78
  }
}
```

#### POST /api/v1/admin/facilities

Create a new facility.

**Request Body:**
```json
{
  "name": "New Recovery Center",
  "street": "456 Hope Ave",
  "city": "Phoenix",
  "state": "AZ",
  "zip": "85001",
  "phone": "(602) 555-0123",
  "website": "https://newrecovery.com",
  "services": ["residential", "outpatient"],
  "description": "New state-of-the-art facility...",
  "operatorId": "operator-uuid",
  "capacity": 32,
  "amenities": ["gym", "pool", "library"]
}
```

#### PUT /api/v1/admin/facilities/{id}

Update an existing facility.

#### DELETE /api/v1/admin/facilities/{id}

Soft delete a facility (marks as inactive).

### Operator Management

#### GET /api/v1/admin/operators

List facility operators with KYC information.

#### POST /api/v1/admin/operators

Register a new operator.

#### GET /api/v1/admin/operators/{id}

Get operator details including KYC status.

### Verification Queue

#### GET /api/v1/admin/verification

List facilities pending verification.

**Response:**
```json
{
  "success": true,
  "queue": [
    {
      "facilityId": "uuid-here",
      "facilityName": "Pending Facility",
      "submittedAt": "2024-01-14T15:22:00Z",
      "priority": "high",
      "changes": [
        {
          "field": "services",
          "oldValue": ["outpatient"],
          "newValue": ["outpatient", "residential"],
          "reason": "Added residential program"
        }
      ],
      "documentation": [
        {
          "type": "license",
          "url": "https://storage/license.pdf",
          "verified": false
        }
      ]
    }
  ],
  "stats": {
    "pending": 12,
    "priority": {
      "high": 3,
      "medium": 6,
      "low": 3
    }
  }
}
```

#### POST /api/v1/admin/verification/{id}

Process verification request (approve/reject).

### Dashboard Analytics

#### GET /api/v1/admin/dashboard

Get admin dashboard metrics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "facilities": {
      "total": 12500,
      "verified": 8200,
      "pending": 145,
      "growth": {
        "thisMonth": 125,
        "lastMonth": 98,
        "percentChange": 27.5
      }
    },
    "searches": {
      "total": 45000,
      "thisWeek": 8500,
      "topLocations": [
        {"location": "Los Angeles, CA", "count": 1250},
        {"location": "New York, NY", "count": 890}
      ]
    },
    "performance": {
      "averageResponseTime": "145ms",
      "uptime": "99.97%",
      "errorRate": "0.03%"
    }
  }
}
```

## Geospatial API Endpoints

### Regional Search

#### GET /api/v1/region/search

Search facilities within geographic regions.

**Parameters:**
- `bounds` (string): Geographic bounding box "sw_lat,sw_lng,ne_lat,ne_lng"
- `polygon` (string): GeoJSON polygon for complex regions
- `services` (string[]): Service filters
- `cluster` (boolean): Enable result clustering

#### GET /api/v1/region/nearby/{lat}/{lng}/{radius}

Find facilities near specific coordinates.

#### POST /api/v1/region/polygon

Search within custom polygon regions.

### Batch Operations

#### POST /api/v1/batch

Process multiple operations in a single request.

**Request Body:**
```json
{
  "operations": [
    {
      "type": "search",
      "params": {"location": "Los Angeles, CA", "limit": 10}
    },
    {
      "type": "details", 
      "facilityId": "uuid-here"
    }
  ]
}
```

## Health & Monitoring

### System Health

#### GET /api/health

Comprehensive system health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-29T15:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 45
    },
    "supabase": {
      "status": "up", 
      "responseTime": 67
    },
    "memory": {
      "used": 245,
      "total": 512,
      "percentage": 47.8
    },
    "env": {
      "nodeVersion": "v20.10.0",
      "platform": "linux",
      "environment": "production"
    }
  }
}
```

#### GET /api/health/live

Fast liveness check (< 10ms response).

#### GET /api/health/ready

Readiness check including all dependencies.

### Metrics

#### GET /api/metrics

Prometheus-compatible metrics endpoint.

**Response:**
```
# HELP soberlivings_api_requests_total Total number of API requests
# TYPE soberlivings_api_requests_total counter
soberlivings_api_requests_total{method="GET",endpoint="/api/facilities/search",status="200"} 12450

# HELP soberlivings_api_request_duration_seconds API request duration
# TYPE soberlivings_api_request_duration_seconds histogram
soberlivings_api_request_duration_seconds_bucket{le="0.1"} 8234
soberlivings_api_request_duration_seconds_bucket{le="0.5"} 11890
```

## Webhooks

### Event Types

The API supports webhooks for real-time event notifications:

- `facility.created` - New facility added
- `facility.updated` - Facility information changed
- `facility.verified` - Facility verification status changed
- `operator.registered` - New operator registered
- `search.completed` - Search analytics event

### Webhook Configuration

#### POST /api/v1/admin/webhooks

Register a new webhook endpoint.

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/soberlivings",
  "events": ["facility.created", "facility.updated"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### Webhook Payload

```json
{
  "id": "webhook-event-id",
  "event": "facility.created",
  "timestamp": "2024-01-29T15:30:00Z",
  "data": {
    "facility": {
      "id": "facility-uuid",
      "name": "New Recovery Center",
      "// ... full facility object": "..."
    }
  },
  "signature": "sha256=signature-here"
}
```

## ETL Pipeline

### ETL Management

#### POST /api/v1/etl

Trigger ETL pipeline operations.

**Request Body:**
```json
{
  "operation": "full-import",
  "sources": ["findtreatment.gov", "manual"],
  "config": {
    "includeInactive": false,
    "validateData": true,
    "enableEnrichment": true
  }
}
```

#### GET /api/v1/etl/status

Get ETL pipeline status and progress.

**Response:**
```json
{
  "status": "running",
  "startedAt": "2024-01-29T14:00:00Z",
  "progress": {
    "current": 1250,
    "total": 5000,
    "percentage": 25.0
  },
  "stages": {
    "extract": "completed",
    "transform": "running", 
    "load": "pending",
    "validate": "pending"
  },
  "stats": {
    "processed": 1250,
    "created": 45,
    "updated": 203,
    "errors": 2
  }
}
```

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      {
        "field": "limit",
        "message": "Must be between 1 and 100",
        "value": 500
      }
    ]
  },
  "requestId": "req_123456789",
  "timestamp": "2024-01-29T15:30:00Z"
}
```

### HTTP Status Codes

- `200` - OK
- `201` - Created  
- `204` - No Content
- `304` - Not Modified
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `412` - Precondition Failed
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `AUTHENTICATION_REQUIRED` | Authentication needed |
| `INSUFFICIENT_PERMISSIONS` | Access denied |
| `DATABASE_ERROR` | Database operation failed |
| `EXTERNAL_SERVICE_ERROR` | External service unavailable |
| `IDEMPOTENCY_CONFLICT` | Idempotency key conflict |

## Examples

### JavaScript/TypeScript Client

```typescript
// Facility search
const searchFacilities = async (location: string) => {
  const response = await fetch(
    `https://api.soberlivings.com/api/facilities/search?location=${encodeURIComponent(location)}`
  );
  const data = await response.json();
  return data.facilities;
};

// With authentication
const getFacilityDetails = async (id: string, apiKey: string) => {
  const response = await fetch(
    `https://api.soberlivings.com/api/v1/facilities/${id}`,
    {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.json();
};
```

### Python Client

```python
import requests

class SoberLivingsAPI:
    def __init__(self, api_key=None):
        self.base_url = "https://api.soberlivings.com"
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({'X-API-Key': api_key})

    def search_facilities(self, location, services=None, limit=50):
        params = {'location': location, 'limit': limit}
        if services:
            params['services'] = services
        
        response = self.session.get(
            f"{self.base_url}/api/facilities/search",
            params=params
        )
        response.raise_for_status()
        return response.json()

# Usage
client = SoberLivingsAPI(api_key="your-api-key")
facilities = client.search_facilities("Los Angeles, CA", services=["residential"])
```

### cURL Examples

```bash
# Basic search
curl "https://api.soberlivings.com/api/facilities/search?location=San%20Francisco,%20CA"

# Authenticated request
curl -H "X-API-Key: your-api-key" \
  "https://api.soberlivings.com/api/v1/admin/facilities"

# POST with JSON body
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"name": "New Facility", "city": "Phoenix", "state": "AZ"}' \
  "https://api.soberlivings.com/api/v1/admin/facilities"
```

## OpenAPI Specification

The complete OpenAPI 3.1.0 specification is available at:
- **JSON**: `/api/v1/openapi.json`
- **Interactive Docs**: `/api/v1/docs`

## Support

- **Documentation**: https://docs.soberlivings.com
- **Issues**: support@soberlivings.com  
- **Status Page**: https://status.soberlivings.com
- **GitHub**: https://github.com/your-org/soberlivings

---

**API Version**: 1.0.0  
**Last Updated**: January 29, 2024  
**Next Review**: March 29, 2024