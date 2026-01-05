# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2026-01-05-server-pino-logging/spec.md

> Created: 2026-01-05
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Logger Module (`server/logger.ts`)**
- Verify logger instance is created successfully
- Verify logger has correct configuration for development vs production
- Verify log methods (info, error, warn, debug) exist and are callable

**Logging Middleware**
- Verify request logging middleware captures request metadata
- Verify response logging middleware captures response metadata and duration
- Verify user context is extracted from session when present
- Verify user context is undefined when session is not present
- Verify duration calculation is accurate
- Verify middleware calls next() to continue request processing

### Integration Tests

**Request Logging Flow**
- Make authenticated API request and verify log entry is created with username
- Make unauthenticated API request and verify log entry is created without username
- Make request that results in error and verify error log includes full context
- Verify log files are created in logs/ directory
- Verify log entries include all required fields (timestamp, method, path, status, duration)

**Error Logging**
- Trigger authentication error and verify error log includes stack trace
- Trigger database error and verify error log includes request context
- Trigger validation error and verify error log includes error details

### File System Tests

**Log File Management**
- Verify logs/ directory is created if it doesn't exist
- Verify log files follow naming pattern `app-YYYY-MM-DD.log`
- Verify log files contain valid JSON entries (one per line)
- Verify .gitignore includes logs/ directory

### Mocking Requirements

- Mock file system for unit tests to avoid creating actual log files
- Mock pino transport for testing without file I/O
- Mock req.session for testing user context extraction
- Use in-memory stream for capturing log output in tests
