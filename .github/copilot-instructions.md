# GitHub Copilot Instructions for Solana Order Execution Engine

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Context

This is a Solana order execution engine built with TypeScript, Fastify, BullMQ, Redis, and PostgreSQL. The system processes trading orders (market, limit, sniper) with DEX routing between Raydium and Meteora, real-time WebSocket updates, and concurrent queue processing.

## Code Style Guidelines

- Use TypeScript with strict type checking
- Follow functional programming patterns where appropriate
- Implement proper error handling with try-catch blocks
- Use async/await for asynchronous operations
- Include JSDoc comments for complex functions
- Follow camelCase for variables and functions, PascalCase for classes and interfaces

## Architecture Patterns

- **Services**: Business logic and external integrations
- **Models**: Database interactions and data structures
- **Routes**: API endpoints and request handling
- **Queues**: Background job processing with BullMQ
- **Types**: TypeScript interfaces and enums
- **Utils**: Helper functions and utilities

## Key Dependencies

- Fastify for HTTP server and WebSocket support
- BullMQ + Redis for job queues
- PostgreSQL for persistent storage
- Joi for request validation
- Jest for testing

## Testing Approach

- Unit tests for individual services and utilities
- Integration tests for API endpoints
- Mock external dependencies (database, queue)
- Test both success and error scenarios
- Include edge cases and validation testing

## Order Processing Flow

1. Order submission → Validation → Queue
2. Queue processing → DEX routing → Price comparison
3. Execution → Status updates → WebSocket broadcast
4. Error handling → Retry logic → Failure tracking

## Database Schema

- Orders table with UUID primary keys
- Status tracking (pending, routing, building, submitted, confirmed, failed)
- Proper indexing on status and created_at fields

## Performance Considerations

- Connection pooling for database
- Rate limiting (100 orders/minute)
- Concurrent processing (max 10 orders)
- Exponential backoff for retries
- Efficient WebSocket broadcasting

## Security Best Practices

- Input validation with Joi schemas
- SQL injection prevention with parameterized queries
- CORS configuration for API access
- Environment variable configuration
- Graceful error messages without sensitive data exposure
