import { prisma } from './db'

async function checkLogs() {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10
    })

    console.log(`\n✅ Found ${logs.length} logs in database:\n`)

    logs.forEach((log) => {
      console.log(`[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}`)
      if (log.path) console.log(`   Path: ${log.method} ${log.path}`)
      if (log.username) console.log(`   User: ${log.username}`)
      if (log.context) console.log(`   Context:`, log.context)
      if (log.error_message) console.log(`   Error: ${log.error_message}`)
      console.log('')
    })

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error checking logs:', error)
    process.exit(1)
  }
}

checkLogs()
