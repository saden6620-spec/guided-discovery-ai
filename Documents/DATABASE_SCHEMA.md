# DATABASE_SCHEMA.md
Version: 1.0

---

# Purpose

This document defines the logical database schema for Guided Discovery AI.

The platform follows a database-per-service architecture.

Each backend service owns its own database objects.

No service directly reads or writes another service's database.

Cross-service communication occurs through APIs and events.

---

# Database Principles

The schema follows these principles.

## Single Ownership

Every table belongs to one service.

---

## Normalization

Avoid unnecessary duplication.

---

## Event Consistency

Cross-service updates occur asynchronously.

---

## Auditability

Important actions should be traceable.

---

## Security

Sensitive data should be encrypted.

---

## Extensibility

Schemas should support future expansion without breaking compatibility.

---

# Primary Database

Technology:

PostgreSQL

Purpose:

Transactional application data.

---

# Supporting Databases

Redis

Purpose:

Caching

Sessions

Temporary state

Rate limiting

---

Qdrant

Purpose:

Vector embeddings

Semantic memory

Similarity search

---

OpenSearch

Purpose:

Full-text search

Search indexes

---

ClickHouse

Purpose:

Analytics

Usage metrics

Reporting

---

# Authentication Service Schema

## users

Stores authentication identities.

Fields:

- id
- email
- password_hash
- auth_provider
- created_at
- updated_at
- last_login

---

## sessions

Stores active sessions.

Fields:

- id
- user_id
- refresh_token
- expires_at
- device_info
- ip_address

---

## oauth_accounts

Stores linked providers.

Examples:

Google

Apple

GitHub

Microsoft

---

# User Service Schema

## user_profiles

Stores public profile information.

Fields:

- user_id
- display_name
- avatar
- biography
- preferred_language
- timezone
- country

---

## user_preferences

Stores personalization settings.

Examples:

Teaching style

Notification frequency

Adventure level

Conversation length

Preferred units

Theme

---

## accessibility_profiles

Stores accessibility preferences.

Examples:

Font size

Voice preference

High contrast

Captioning

Mobility options

---

# Memory Service Schema

## memories

Stores long-term memories.

Fields:

- id
- user_id
- title
- summary
- category
- importance
- embedding_id
- created_at

---

## memory_categories

Examples:

Travel

Learning

People

Preferences

Health

Goals

Projects

---

## memory_links

Connects related memories.

---

# Navigation Service Schema

## trips

Stores travel sessions.

---

## routes

Stores generated routes.

---

## destinations

Saved destinations.

---

## visited_locations

Historical visits.

---

## landmarks

Known landmarks.

---

# Planning Service Schema

## itineraries

Trip plans.

---

## itinerary_items

Activities.

---

## reservations

Tickets

Bookings

Reservations

---

## travel_checklists

Packing

Preparation

Requirements

---

# Recommendation Service Schema

## recommendations

Generated recommendations.

---

## recommendation_history

Accepted

Rejected

Ignored

Dismissed

---

## recommendation_scores

Internal scoring.

---

# Learning Service Schema

## skills

Skill definitions.

---

## user_skills

Current progress.

---

## achievements

Achievement catalog.

---

## unlocked_achievements

User achievements.

---

## xp_history

Experience point history.

---

# Documentation Service Schema

## journals

Travel journals.

---

## journal_entries

Daily entries.

---

## media

Photos

Videos

Audio

---

## reflections

Reflection notes.

---

# Translation Service Schema

## translation_history

User-approved translation history.

---

## downloaded_languages

Offline language packs.

---

# Community Service Schema

## community_profiles

Public profiles.

---

## posts

Community posts.

---

## comments

Discussion.

---

## reactions

Likes

Helpful

Bookmarks

---

## friendships

Optional social graph.

---

# Notification Service Schema

## notifications

Scheduled notifications.

---

## notification_history

Delivered notifications.

---

# Media Service Schema

## uploads

Uploaded files.

---

## media_metadata

Technical information.

---

## processing_jobs

Media processing queue.

---

# Search Service Schema

## search_index_metadata

Index configuration.

---

## search_logs

Anonymous search analytics.

---

# Permission Service Schema

## permissions

Current permission state.

---

## consent_history

Permission changes.

---

## privacy_settings

Privacy configuration.

---

# Analytics Schema

## usage_events

Anonymous usage metrics.

---

## feature_usage

Feature adoption.

---

## performance_metrics

System performance.

---

## crash_reports

Application failures.

---

# Common Fields

Most tables should include:

- id
- created_at
- updated_at

Where appropriate:

- deleted_at
- created_by
- updated_by
- version

---

# Relationships

Examples:

User

↓

Trips

↓

Itinerary

↓

Journal

↓

Memories

↓

Achievements

Relationships should remain inside service boundaries whenever possible.

Cross-service references should use identifiers rather than foreign keys.

---

# Vector Storage

Embeddings are stored separately.

Metadata remains inside PostgreSQL.

Vector IDs reference embedding records inside Qdrant.

---

# Search Indexes

Search indexes should be generated automatically.

Examples:

Journal text

Memory summaries

Community posts

Landmarks

Learning notes

Indexes should be rebuilt asynchronously.

---

# Memory Deletion and Temporary Retention

When users delete memories:

Deletion takes effect immediately from the user's perspective.

Deleted memories:

- Immediately disappear from the application.
- Cannot be retrieved by search.
- Cannot be used by the AI.
- Cannot affect recommendations.
- Cannot affect personalization.
- Cannot appear in analytics or normal application behavior.

Internally, the system may temporarily retain a soft-deleted record only for:

- Synchronization.
- Distributed deletion.
- Rollback-safe processing.
- Legally required retention.

A temporarily retained soft-deleted record must remain excluded from all user-visible and normal application behavior.

After the applicable retention period expires, the system must permanently delete:

- Database rows.
- Embeddings.
- Vector records.
- Search indexes.
- Graph links.
- Caches.
- Derived records.

Soft-deletion behavior for other user-owned content, including journal entries, posts, and media, follows the retention policy defined for that content.

---

# Audit Logging

Sensitive operations should generate audit events.

Examples:

Permission changes

Memory deletion

Profile updates

Emergency overrides

Data exports

Account deletion

---

# Encryption

Sensitive fields should be encrypted.

Examples:

Health information

Precise location history

Emergency contacts

Personal notes

Authentication tokens

Encryption should occur before persistent storage whenever practical.

---

# Data Retention

Retention policies should be configurable.

Examples:

Temporary sessions

Analytics

Translation history

Location history

Audit logs

Users should retain control over personal data whenever applicable.

---

# Migration Strategy

Every schema change should use versioned migrations.

Migrations should be:

Repeatable

Rollback-safe

Documented

Tested

No manual production schema changes.

---

# Future Expansion

The schema should support future additions.

Examples:

Robot telemetry

Drone missions

AR experiences

Educational institutions

Marketplace

Wearable devices

No redesign should be required for future modules.

---

# Success Indicators

The database architecture succeeds when:

Every service owns its data.

Schemas remain understandable.

Scaling remains practical.

Data remains secure.

Future features integrate cleanly.

---

# Acceptance Criteria

The database schema is correctly implemented when:

✓ Every service owns its own schema.

✓ Cross-service communication avoids direct database access.

✓ Sensitive data is encrypted.

✓ Audit logging is available.

✓ Vector search integrates cleanly.

✓ Search indexes remain asynchronous.

✓ Future schema evolution is straightforward.
