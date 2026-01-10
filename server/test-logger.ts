import { logger } from './logger'

// Test various log levels
logger.info('Testing info level log')
logger.warn('Testing warn level log')
logger.error({ error: new Error('Test error'), customField: 'test' }, 'Testing error level log')

// Test with request context
logger.info({
  path: '/data/api/test',
  method: 'GET',
  username: 'TEST_USER',
  statusCode: 200
}, 'Testing log with request context')

// Test with user context
logger.info({
  userId: '12345',
  username: 'TEST_USER',
  requestId: 'req-12345'
}, 'Testing log with user context')

console.log('\n✅ Test logs sent. Check your database logs table!')
console.log('Run: SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5;\n')

// Wait a moment for logs to be written, then exit
setTimeout(() => {
  process.exit(0)
}, 2000)
