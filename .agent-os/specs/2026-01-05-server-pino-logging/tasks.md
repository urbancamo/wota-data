# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2026-01-05-server-pino-logging/spec.md

> Created: 2026-01-05
> Status: Ready for Implementation

## Tasks

- [x] 1. Install dependencies and create logger module
  - [x] 1.1 Install pino and pino-pretty packages
  - [x] 1.2 Create server/logger.ts with pino configuration
  - [x] 1.3 Configure dual transports (console pretty + file JSON with daily rotation)
  - [x] 1.4 Create logs/ directory structure with .gitkeep
  - [x] 1.5 Export configured logger instance

- [x] 2. Implement request/response logging middleware
  - [x] 2.1 Write tests for logging middleware
  - [x] 2.2 Create middleware to capture request start time and user context
  - [x] 2.3 Create middleware to log response completion with duration
  - [x] 2.4 Extract username/callsign from req.session when available
  - [x] 2.5 Add logging middleware to Express app before route handlers
  - [x] 2.6 Verify all tests pass

- [x] 3. Replace console.log/error with pino logger
  - [x] 3.1 Replace console.log in health check and utility functions
  - [x] 3.2 Replace console.error in authentication endpoints with logger.error
  - [x] 3.3 Replace console.error in import endpoints with logger.error
  - [x] 3.4 Replace console.error in data fetch endpoints with logger.error
  - [x] 3.5 Replace console.log in SOTA lookup and exports with logger.info
  - [x] 3.6 Ensure error logs include stack traces and request context
  - [x] 3.7 Verify all tests pass

- [ ] 4. Verify and test complete implementation
  - [ ] 4.1 Start server and make authenticated API requests
  - [ ] 4.2 Verify log files are created in logs/ directory with correct naming
  - [ ] 4.3 Verify log entries include username/callsign for authenticated requests
  - [ ] 4.4 Trigger errors and verify error logs include full context
  - [ ] 4.5 Verify console output shows pretty-formatted logs
  - [ ] 4.6 Verify file output contains structured JSON
  - [ ] 4.7 Run all tests and ensure they pass
