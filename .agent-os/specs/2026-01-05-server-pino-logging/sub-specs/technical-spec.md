# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2026-01-05-server-pino-logging/spec.md

> Created: 2026-01-05
> Version: 1.0.0

## Technical Requirements

- Install pino and pino-pretty packages for logging
- Configure pino with daily log rotation using pino's built-in transport system
- Create logger configuration that writes to both console (development) and file (all environments)
- Implement Express middleware that logs request metadata before processing
- Implement Express middleware that logs response metadata after processing
- Replace all console.log and console.error calls with appropriate pino log levels
- Extract user information from req.session.username when available
- Create logs/ directory structure that is git-ignored
- Use structured logging (JSON) for file output
- Use pretty-printed logs for console output in development
- Log format should include: timestamp, level, HTTP method, path, status code, duration, username/callsign, message
- Error logs should include: error message, stack trace, request method, request path, user context

## Approach

### Logger Configuration

Create a centralized logger module (`server/logger.ts`) that exports a configured pino instance with:
- Dual transports: console (pretty format) and file (JSON format with daily rotation)
- Log levels: info (default), error, warn, debug
- File rotation: daily, stored in `logs/` directory with pattern `app-YYYY-MM-DD.log`
- Pretty printing for console in development mode
- Structured JSON for file output

### Request Logging Middleware

Implement two middleware functions:
1. **Request Logger** - Logs incoming requests with initial metadata
2. **Response Logger** - Logs response completion with status code and duration

The middleware will:
- Capture request start time
- Extract user from req.session.username if authenticated
- Calculate response duration
- Log structured data including method, path, status, duration, and user

### Error Handling Integration

Update existing error handling to use pino:
- Replace `console.error()` calls with `logger.error()`
- Include error object, stack trace, and request context
- Maintain existing error response behavior

## External Dependencies

- **pino** (^9.0.0) - Fast, low-overhead logging library
  - Justification: Industry standard for Node.js logging with excellent performance, structured logging support, and minimal overhead

- **pino-pretty** (^12.0.0) - Pretty printer for pino logs
  - Justification: Provides human-readable console output during development while maintaining structured JSON for file logs

## Implementation Details

### Directory Structure
```
logs/
  app-2026-01-05.log
  app-2026-01-06.log
  .gitkeep
```

### Log Entry Example (File - JSON)
```json
{
  "level": 30,
  "time": 1704412800000,
  "pid": 12345,
  "hostname": "server",
  "method": "POST",
  "path": "/data/api/import/adif",
  "statusCode": 200,
  "duration": 145,
  "username": "M0ABC",
  "msg": "Request completed"
}
```

### Log Entry Example (Console - Pretty)
```
[2026-01-05 10:30:15] INFO: Request completed
  method: "POST"
  path: "/data/api/import/adif"
  statusCode: 200
  duration: 145ms
  username: "M0ABC"
```

### Error Log Example
```json
{
  "level": 50,
  "time": 1704412800000,
  "error": {
    "type": "DatabaseError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n  at ..."
  },
  "req": {
    "method": "POST",
    "path": "/data/api/import/adif",
    "username": "M0ABC"
  },
  "msg": "Import error"
}
```

## Configuration Strategy

Use environment variable to control log levels:
- `LOG_LEVEL` - Set minimum log level (default: 'info')
- Development: Pretty console + JSON file
- Production: JSON console + JSON file with rotation
