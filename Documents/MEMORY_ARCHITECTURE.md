# MEMORY_ARCHITECTURE.md
Version: 1.0

---

# Purpose

This document defines the architecture of the Guided Discovery AI Memory System.

The Memory System is responsible for storing, organizing, retrieving, updating, linking, and forgetting information throughout the user's lifetime.

Memory should improve personalization without overwhelming the AI or violating user privacy.

---

# Design Goals

The Memory System should be:

- Relevant
- Explainable
- Permission-aware
- Scalable
- Efficient
- Modular
- User-controlled

Memory should support learning rather than simply recording information.

---

# Core Philosophy

The AI should remember information because it helps the user.

It should not remember everything.

The system should prioritize quality over quantity.

Users should always understand why something was remembered.

---

# Memory Layers

The memory architecture consists of multiple layers.

```
User Input

↓

Working Memory

↓

Session Memory

↓

Long-Term Memory

↓

Knowledge Graph

↓

Vector Index

↓

Archived Memory
```

Each layer serves a different purpose.

---

# Working Memory

## Purpose

Stores information required to complete the current request.

---

Lifetime

Seconds.

---

Examples

Current conversation.

Temporary calculations.

Current route.

Recent tool outputs.

---

Characteristics

Fast.

Small.

Never persisted.

Automatically discarded.

---

# Session Memory

## Purpose

Stores context during the active session.

---

Lifetime

Current conversation.

---

Examples

Questions asked.

Current topic.

Temporary preferences.

Current trip state.

---

Characteristics

Discarded when session ends unless promoted.

---

# Long-Term Memory

## Purpose

Stores valuable information across sessions.

---

Examples

User preferences.

Goals.

Projects.

Travel history.

Learning progress.

Relationships.

Long-term interests.

Important achievements.

---

Characteristics

Persistent.

Searchable.

Permission-controlled.

Editable.

---

# Semantic Memory

Stores factual knowledge about the user.

Examples:

Preferred language.

Favorite museum types.

Accessibility settings.

Learning preferences.

Frequently visited cities.

---

# Episodic Memory

Stores experiences.

Examples:

Trip to Rome.

Museum visit.

Completed challenge.

Conversation about graduation project.

Important life events approved by the user.

---

# Procedural Memory

Stores learned behaviors.

Examples:

Preferred explanation style.

Preferred route style.

Notification preferences.

Teaching preferences.

Interaction style.

---

# Knowledge Graph

Purpose:

Connect related memories.

Examples:

```
Robotics

↓

Graduation Project

↓

Spider Robot

↓

ROS2

↓

Computer Vision
```

The graph improves reasoning by identifying relationships between memories.

---

# Vector Index

Every eligible memory receives an embedding.

The embedding enables:

Semantic search.

Context retrieval.

Similarity matching.

Recommendation support.

Only metadata remains inside the relational database.

Embeddings remain inside the vector database.

---

# Memory Categories

Examples include:

Identity

Preferences

Goals

Projects

Travel

Learning

Relationships

Health

Accessibility

Skills

Achievements

Locations

Community

Future categories should be easy to add.

---

# Memory Lifecycle

Every memory follows the same lifecycle.

```
Created

↓

Evaluated

↓

Stored

↓

Linked

↓

Retrieved

↓

Updated

↓

Archived

↓

Deleted
```

---

# Memory Creation

A memory is only created if:

Permission exists.

The information has future value.

The information is not duplicated.

The confidence threshold is met.

---

# Memory Importance

Each memory receives an importance score.

Possible factors:

Frequency.

Recency.

User confirmation.

Emotional significance.

Goal relevance.

Project relevance.

Learning value.

Frequently used memories become easier to retrieve.

---

# Memory Retrieval

Retrieval combines:

Keyword search.

Semantic search.

Context filtering.

Permission filtering.

Importance scoring.

Recency scoring.

Only the most relevant memories should enter Working Memory.

---

# Memory Updating

Memories evolve.

Examples:

Preference changes.

Goals completed.

Relationships change.

Projects evolve.

Old information should be updated rather than duplicated.

---

# Memory Linking

Related memories should be connected.

Examples:

Trip

↓

Journal

↓

Photos

↓

Learning

↓

Recommendations

↓

Achievements

The AI should reason across connected memories.

---

# Memory Forgetting

Not every memory should last forever.

Memories may be:

Archived.

Merged.

Deleted.

Forgotten.

Forgetting reduces clutter and improves retrieval quality.

---

# Memory Deletion

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

---

# User Control

Users may:

View memories.

Search memories.

Edit memories.

Delete memories.

Disable memory.

Export memory.

Restore archived memory.

The Memory System should remain transparent.

---

# Privacy

Every memory must include:

Owner.

Permission scope.

Visibility.

Retention policy.

Sensitivity level.

Encryption status.

Privacy is enforced before retrieval.

---

# Memory Retrieval Pipeline

```
Request

↓

Context Analysis

↓

Permission Check

↓

Candidate Retrieval

↓

Semantic Ranking

↓

Importance Ranking

↓

Context Filtering

↓

Working Memory
```

---

# Conflict Resolution

If memories conflict:

Prefer:

Most recent.

Explicit user correction.

High-confidence memories.

Verified memories.

The AI should acknowledge uncertainty when necessary.

---

# Memory Compression

Older memories may be summarized.

Examples:

Daily conversations

↓

Weekly summary

↓

Monthly summary

↓

Long-term knowledge

Compression reduces storage without losing valuable information.

---

# Memory Expiration

Examples:

Temporary preferences.

Expired trips.

Completed reminders.

Old navigation sessions.

Expiration policies should remain configurable.

---

# Explainability

Users may ask:

"What do you remember about me?"

"Why did you remember this?"

"Where did this information come from?"

The AI should answer transparently.

---

# Security

Sensitive memories should support:

Encryption.

Permission validation.

Audit logging.

Secure deletion.

Version history.

---

# Performance Goals

Working Memory Retrieval:

< 100 ms

Semantic Retrieval:

< 500 ms

Memory Update:

< 300 ms

Long-Term Storage:

Asynchronous whenever practical.

---

# Future Expansion

Future memory types may include:

Robot experiences.

Wearable sensor history.

Health trends.

Enterprise projects.

Educational coursework.

AR experiences.

No redesign should be required.

---

# Success Indicators

The Memory Architecture succeeds when:

Relevant memories are easy to retrieve.

Unimportant memories do not accumulate.

Users trust the memory system.

Personalization improves naturally.

Memory remains explainable.

---

# Acceptance Criteria

The Memory Architecture is correctly implemented when:

✓ Memory is organized into multiple layers.

✓ Long-term memory remains selective.

✓ Retrieval uses semantic ranking.

✓ Users fully control stored memories.

✓ Privacy is enforced before retrieval.

✓ Related memories are linked.

✓ Forgetting improves overall memory quality.

✓ Future memory types integrate naturally.
