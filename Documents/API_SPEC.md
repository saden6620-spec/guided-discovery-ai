# API_SPEC.md
Version: 1.0

---

# Purpose

This document defines the API standards for Guided Discovery AI.

The API enables communication between:

- Mobile applications
- Web applications
- Desktop applications
- Robot companion
- AI services
- Backend services
- External integrations

The API should remain stable, versioned, secure, and easy to extend.

---

# API Design Principles

The API follows these principles.

## Resource Oriented

Resources should represent business objects.

Examples:

Users

Trips

Memories

Recommendations

Achievements

Journal Entries

---

## Stateless

Every request contains all required information.

The server should not depend on previous requests.

---

## Consistent

Every endpoint should follow identical conventions.

---

## Secure

Authentication and authorization are required whenever appropriate.

---

## Versioned

Breaking changes require new API versions.

---

# Base URL

```
/api/v1
```

Future versions:

```
/api/v2
/api/v3
```

Older versions remain supported during migration.

---

# Authentication

Authentication uses:

JWT Access Token

Refresh Token

OAuth2

OpenID Connect

Every authenticated request includes:

Authorization:

```
Bearer <access_token>
```

---

# Content Type

Requests

```
application/json
```

Responses

```
application/json
```

File uploads

```
multipart/form-data
```

---

# HTTP Methods

GET

Retrieve data.

---

POST

Create resources.

---

PUT

Replace resources.

---

PATCH

Partial updates.

---

DELETE

Delete resources.

Soft delete when supported.

---

# Response Format

Successful responses:

```json
{
  "success": true,
  "data": {},
  "metadata": {}
}
```

---

Errors

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Trip not found."
  }
}
```

---

# Standard HTTP Codes

200 OK

201 Created

202 Accepted

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Validation Error

429 Too Many Requests

500 Internal Server Error

503 Service Unavailable

---

# Pagination

Large collections use cursor pagination.

Example:

```
GET /memories?cursor=abc123&limit=25
```

Response:

```json
{
  "data": [],
  "nextCursor": "...",
  "hasMore": true
}
```

---

# Filtering

Example:

```
GET /recommendations?category=history
```

---

# Sorting

Example:

```
GET /memories?sort=createdAt&order=desc
```

---

# Searching

Example:

```
GET /search?q=roman+empire
```

---

# Authentication Endpoints

```
POST /auth/login

POST /auth/register

POST /auth/logout

POST /auth/refresh

GET /auth/me
```

---

# User Endpoints

```
GET /users/me

PATCH /users/me

DELETE /users/me

GET /users/preferences

PATCH /users/preferences
```

---

# Memory Endpoints

```
GET /memories

GET /memories/{id}

POST /memories

PATCH /memories/{id}

DELETE /memories/{id}
```

---

# Navigation Endpoints

```
POST /navigation/start

POST /navigation/stop

GET /navigation/status

POST /navigation/reroute
```

---

# Planning Endpoints

```
POST /plans

GET /plans

PATCH /plans/{id}

DELETE /plans/{id}
```

---

# Recommendation Endpoints

```
GET /recommendations

POST /recommendations/{id}/accept

POST /recommendations/{id}/dismiss
```

---

# Learning Endpoints

```
GET /learning/profile

GET /learning/skills

GET /learning/achievements
```

---

# Journal Endpoints

```
GET /journals

POST /journals

PATCH /journals/{id}

DELETE /journals/{id}
```

---

# Translation Endpoints

```
POST /translate/text

POST /translate/speech

POST /translate/image
```

---

# Community Endpoints

```
GET /community/feed

POST /community/posts

PATCH /community/posts/{id}

DELETE /community/posts/{id}
```

---

# Notification Endpoints

```
GET /notifications

PATCH /notifications/{id}

DELETE /notifications/{id}
```

---

# Upload Endpoints

```
POST /media/upload

GET /media/{id}

DELETE /media/{id}
```

---

# Permission Endpoints

```
GET /permissions

PATCH /permissions
```

---

# Search Endpoints

```
GET /search
```

Search should support:

Memories

Trips

Community

Journals

Landmarks

Learning

---

# Rate Limiting

Default:

```
100 requests/minute
```

Authenticated limits may vary.

Emergency endpoints are exempt where appropriate.

---

# Validation

Every request should be validated.

Invalid requests return:

422 Validation Error

Validation errors should identify the offending fields.

---

# Idempotency

Certain POST endpoints should support:

```
Idempotency-Key
```

Examples:

Payment

Booking

Reservation

Account creation

---

# API Versioning

Breaking changes:

```
/api/v2
```

Minor additions:

Remain within current version.

---

# Deprecation

Deprecated endpoints should include:

```
Deprecation

Sunset
```

Headers.

Migration documentation should be provided.

---

# API Documentation

Every endpoint should include:

Description

Parameters

Authentication

Permissions

Examples

Response schema

Error responses

OpenAPI documentation should remain synchronized with implementation.

---

# Security

Every endpoint should support:

TLS

JWT validation

Permission validation

Input sanitization

Rate limiting

Audit logging

---

# Observability

Every request should generate:

Request ID

Timestamp

Duration

Status code

Service name

Tracing ID

---

# Future APIs

The API should support future integrations.

Examples:

Robot Companion

Smart Glasses

Drone

Wearables

Enterprise

Education

Marketplace

Public SDK

No redesign should be required.

---

# Success Indicators

The API succeeds when:

Developers easily integrate.

Clients remain compatible.

Versioning is predictable.

Security remains consistent.

Performance scales.

---

# Acceptance Criteria

The API specification is correctly implemented when:

✓ Endpoints remain consistent.

✓ Authentication is standardized.

✓ Versioning is enforced.

✓ Errors are predictable.

✓ Validation is universal.

✓ Documentation remains synchronized.

✓ Future services integrate without breaking compatibility.