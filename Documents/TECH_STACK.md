# TECH_STACK.md
Version: 1.0

---

# Purpose

This document defines the official technology stack for Guided Discovery AI.

The selected technologies prioritize:

- Scalability
- Performance
- Developer productivity
- AI integration
- Cross-platform support
- Long-term maintainability

Technology choices should remain consistent across the project unless a documented architecture decision replaces them.

---

# Technology Principles

The technology stack follows these principles.

## AI First

Every layer should be designed to support AI workflows.

---

## Cloud Native

Services should be deployable in cloud environments.

---

## Cross Platform

Applications should support multiple operating systems from a shared codebase whenever practical.

---

## Open Standards

Prefer open protocols and widely adopted technologies.

---

## Modular

Every service should be independently replaceable.

---

# Programming Languages

## Frontend

TypeScript

Reason:

Strong typing.

Excellent ecosystem.

Shared language across frontend projects.

---

## Backend

TypeScript

Reason:

Unified development experience.

Strong tooling.

Large ecosystem.

Excellent API support.

---

## AI Services

Python

Reason:

Machine learning ecosystem.

LLM integration.

Data processing.

Computer vision.

Speech processing.

Scientific libraries.

---

## Infrastructure

YAML

Terraform

Bash

Reason:

Infrastructure as Code.

Automation.

Deployment.

---

# Frontend

Framework

React

---

Mobile

React Native

---

Web

Next.js

---

Desktop

Electron

---

State Management

Redux Toolkit

---

Data Fetching

TanStack Query

---

Styling

Tailwind CSS

---

UI Components

Custom Design System

---

Maps

MapLibre GL

---

Charts

Recharts

---

Internationalization

i18next

---

# Backend

Runtime

Node.js

---

Framework

NestJS

---

API Style

REST

GraphQL (future expansion)

---

Authentication

JWT

OAuth 2.0

OpenID Connect

---

Validation

Zod

---

Background Jobs

BullMQ

---

Caching

Redis

---

Search

OpenSearch

---

Notifications

Firebase Cloud Messaging

---

# AI Layer

Language

Python

---

Framework

FastAPI

---

LLM Integration

Model Provider Abstraction Layer

---

Embeddings

Provider-independent interface

---

Vector Database

Qdrant

---

Speech Recognition

Provider abstraction

---

Speech Synthesis

Provider abstraction

---

Vision

OpenCV

---

Document Processing

Unstructured pipeline

---

Planning

Custom orchestration engine

---

Reasoning

AI Orchestrator

---

# Databases

Primary Database

PostgreSQL

---

Cache

Redis

---

Vector Database

Qdrant

---

Object Storage

S3 Compatible Storage

---

Analytics Database

ClickHouse

---

Search

OpenSearch

---

# Infrastructure

Containers

Docker

---

Container Orchestration

Kubernetes

---

Infrastructure as Code

Terraform

---

Reverse Proxy

NGINX

---

API Gateway

Kong

---

Secrets Management

Vault

---

Service Mesh

Istio (future)

---

# Monitoring

Metrics

Prometheus

---

Dashboards

Grafana

---

Logging

Loki

---

Tracing

OpenTelemetry

---

Error Tracking

Sentry

---

# CI/CD

Source Control

GitHub

---

Automation

GitHub Actions

---

Container Registry

GitHub Container Registry

---

Deployment

ArgoCD

---

Quality Checks

ESLint

Prettier

TypeScript

Pytest

Jest

Playwright

---

# Testing

Frontend

Jest

React Testing Library

---

Backend

Jest

Supertest

---

Python

Pytest

---

End-to-End

Playwright

---

Performance

k6

---

Load Testing

Locust

---

Accessibility

axe-core

---

# Security

Dependency Scanning

Dependabot

---

Secrets Scanning

GitHub Secret Scanning

---

Static Analysis

CodeQL

---

Authentication

OAuth 2.0

JWT

---

Encryption

TLS

AES-256

---

# AI Providers

The platform should never depend on a single AI provider.

Supported through an abstraction layer.

Examples:

OpenAI

Anthropic

Google

Local models

Future providers

The application should switch providers with minimal code changes.

---

# Cloud Providers

The architecture should remain cloud agnostic.

Examples:

AWS

Azure

Google Cloud

DigitalOcean

Self-hosted Kubernetes

---

# Development Environment

Package Manager

pnpm

---

Monorepo

Turborepo

---

Version Control

Git

---

Containerized Development

Dev Containers

---

# Documentation

Markdown

---

Architecture Diagrams

Mermaid

---

API Documentation

OpenAPI

Swagger

---

Decision Records

Architecture Decision Records (ADR)

---

# Design

UI Design

Figma

---

Icons

Lucide

---

Illustrations

Custom assets

---

# Guiding Rule

Technology decisions should prioritize maintainability over trends.

Every major dependency should be replaceable through well-defined interfaces.

---

# Success Indicators

The technology stack succeeds when:

Developers remain productive.

The platform scales efficiently.

AI providers remain interchangeable.

Deployment remains repeatable.

Cross-platform development remains practical.

---

# Acceptance Criteria

The technology stack is correctly implemented when:

✓ Frontend, backend, and AI layers are clearly separated.

✓ Infrastructure is fully reproducible.

✓ AI providers can be replaced.

✓ The platform remains cloud agnostic.

✓ Cross-platform applications share common code.

✓ Modern development tooling supports rapid iteration.

✓ Long-term maintainability remains a primary design goal.