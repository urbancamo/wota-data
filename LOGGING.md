# Pino Database Logging Setup

This document describes the Pino logging setup with MySQL database integration.

## Overview

The application now logs to three destinations simultaneously:
1. **Console** - Pretty formatted logs for development
2. **File** - Daily log files in `logs/` directory
3. **Database** - Structured logs in the `logs` MySQL table

## Database Schema

The `logs` table structure:

```sql
CREATE TABLE `logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `timestamp` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `level` VARCHAR(10) NOT NULL,
  `message` TEXT,
  `context` JSON,
  `hostname` VARCHAR(255),
  `pid` INT UNSIGNED,
  `request_id` VARCHAR(64),
  `user_id` VARCHAR(64),
  `username` VARCHAR(64),
  `path` VARCHAR(500),
  `method` VARCHAR(10),
  `status_code` SMALLINT UNSIGNED,
  `error_message` TEXT,
  `error_stack` TEXT,
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_level` (`level`),
  INDEX `idx_request_id` (`request_id`),
  INDEX `idx_username` (`username`),
  INDEX `idx_path_method` (`path`, `method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Usage

### Basic Logging

```typescript
import { logger } from './server/logger'

// Simple logs
logger.info('Application started')
logger.warn('Deprecation warning')
logger.error('Something went wrong')
```

### Logging with Context

```typescript
// Log with request context
logger.info({
  path: '/data/api/users',
  method: 'GET',
  username: 'john_doe',
  statusCode: 200
}, 'User request successful')

// Log with user context
logger.info({
  userId: '12345',
  username: 'jane_smith',
  requestId: 'req-abc-123'
}, 'User action completed')
```

### Error Logging

```typescript
try {
  // Some operation
} catch (error) {
  logger.error({
    error,
    path: req.path,
    method: req.method,
    username: req.session?.username
  }, 'Operation failed')
}
```

## Log Fields

The database logger automatically extracts and stores:

- **timestamp** - When the log occurred (with millisecond precision)
- **level** - trace, debug, info, warn, error, fatal
- **message** - The log message
- **context** - Any additional data as JSON
- **hostname** - Server hostname
- **pid** - Process ID
- **request_id** - Request tracking ID (if provided)
- **user_id** - User ID (if provided)
- **username** - Username (if provided)
- **path** - API endpoint path (if provided)
- **method** - HTTP method (if provided)
- **status_code** - HTTP status code (if provided)
- **error_message** - Error message (if error logged)
- **error_stack** - Error stack trace (if error logged)

## Querying Logs

### Using Prisma

```typescript
import { prisma } from './server/db'

// Get recent logs
const logs = await prisma.log.findMany({
  orderBy: { timestamp: 'desc' },
  take: 100
})

// Get error logs
const errors = await prisma.log.findMany({
  where: { level: 'error' },
  orderBy: { timestamp: 'desc' }
})

// Get logs for specific user
const userLogs = await prisma.log.findMany({
  where: { username: 'john_doe' },
  orderBy: { timestamp: 'desc' }
})

// Get logs for specific endpoint
const apiLogs = await prisma.log.findMany({
  where: {
    path: '/data/api/import/adif',
    method: 'POST'
  },
  orderBy: { timestamp: 'desc' }
})
```

### Using SQL

```sql
-- Recent logs
SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100;

-- Error logs from last hour
SELECT * FROM logs
WHERE level = 'error'
  AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC;

-- Logs by user
SELECT * FROM logs
WHERE username = 'john_doe'
ORDER BY timestamp DESC;

-- API endpoint activity
SELECT path, method, COUNT(*) as count
FROM logs
WHERE path IS NOT NULL
GROUP BY path, method
ORDER BY count DESC;
```

## Development Commands

```bash
# Build the database transport
npm run build:transport

# Start the API server (automatically builds transport)
npm run api

# Test logging
tsx server/test-logger.ts

# Check logs in database
tsx server/check-logs.ts
```

## Configuration

### Log Level

Set the log level via environment variable:

```bash
# In .env file
LOG_LEVEL=debug  # Options: trace, debug, info, warn, error, fatal
```

### Environment

The logger automatically detects the environment:

- **Development** (`NODE_ENV !== 'production'`) - Pretty console logs + file + database
- **Production** - JSON console logs + file + database

## Files

- `server/logger.ts` - Logger configuration
- `server/transports/pino-database-transport.ts` - Database transport (TypeScript)
- `server/transports/pino-database-transport.js` - Compiled transport (JavaScript)
- `server/test-logger.ts` - Test script
- `server/check-logs.ts` - Database query script

## Performance Notes

- Database writes are **non-blocking** and won't slow down your application
- Failed database writes are logged to console but won't crash the app
- Logs are written in a worker thread to avoid blocking the main event loop
- The `context` field uses JSON type for efficient storage and querying

## Monitoring & Analytics

You can build powerful monitoring dashboards by querying the logs table:

```sql
-- Request rate by endpoint (last hour)
SELECT
  path,
  method,
  COUNT(*) as requests,
  AVG(status_code) as avg_status
FROM logs
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
  AND path IS NOT NULL
GROUP BY path, method;

-- Error rate by user
SELECT
  username,
  COUNT(*) as error_count
FROM logs
WHERE level = 'error'
  AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND username IS NOT NULL
GROUP BY username
ORDER BY error_count DESC;

-- Most active users
SELECT
  username,
  COUNT(*) as activity_count
FROM logs
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND username IS NOT NULL
GROUP BY username
ORDER BY activity_count DESC
LIMIT 10;
```

## Troubleshooting

### Logs not appearing in database

1. Check that the transport was built: `npm run build:transport`
2. Verify database connection in `.env`
3. Check console for database errors
4. Verify the `logs` table exists

### Transport build errors

Make sure TypeScript is installed:
```bash
npm install --save-dev typescript
```

### Database connection errors

Check your `WOTA_DATABASE_URL` environment variable is correctly configured in `.env`

## Future Enhancements

Potential improvements:

- Log rotation/archival for old database logs
- Dashboard UI for viewing logs
- Real-time log streaming via WebSockets
- Alert system for critical errors
- Log aggregation and analysis tools
