/**
 * Database Stub Wrapper
 *
 * This module provides a wrapper around Prisma that logs mutation operations
 * instead of executing them when stub mode is enabled. Read operations execute normally.
 */

type PrismaOperation =
  // Read operations (execute normally)
  | 'findMany' | 'findFirst' | 'findUnique' | 'count' | 'groupBy'
  // Mutation operations (stubbed)
  | 'create' | 'createMany' | 'update' | 'updateMany' | 'delete' | 'deleteMany' | 'upsert'

/**
 * Creates a stubbed Prisma client that logs operations instead of executing them
 */
export function createPrismaStub(realPrisma: any): any {
  const logOperation = (model: string, operation: PrismaOperation, args?: any) => {
    console.log('\n📝 DATABASE OPERATION (STUBBED):')
    console.log(`   Model: ${model}`)
    console.log(`   Operation: ${operation}`)
    if (args) {
      console.log(`   Arguments:`, JSON.stringify(args, null, 2))
    }
    console.log('')
  }

  // Mock data generators for stubbed mutation operations
  const generateMockResult = (model: string, operation: PrismaOperation, args?: any): any => {
    switch (operation) {
      case 'create':
        return {
          id: 999999,
          ...args?.data,
        }

      case 'createMany':
        return {
          count: Array.isArray(args?.data) ? args.data.length : 1
        }

      case 'update':
        return {
          id: args?.where?.id || 999999,
          ...args?.data,
        }

      case 'updateMany':
        return { count: 1 }

      case 'upsert':
        return {
          id: 999999,
          ...args?.create,
          ...args?.update,
        }

      case 'delete':
        return {
          id: args?.where?.id || 999999,
        }

      case 'deleteMany':
        return { count: 0 }

      default:
        return null
    }
  }

  // Define read vs mutation operations
  const readOperations = new Set(['findMany', 'findFirst', 'findUnique', 'count', 'groupBy'])
  const mutationOperations = new Set(['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'])

  // Create a proxy for each Prisma model
  const createModelProxy = (modelName: string) => {
    return new Proxy({}, {
      get(target, operation: string) {
        return async (args?: any) => {
          // Allow read operations to execute normally
          if (readOperations.has(operation)) {
            return realPrisma[modelName][operation](args)
          }

          // Stub mutation operations
          if (mutationOperations.has(operation)) {
            logOperation(modelName, operation as PrismaOperation, args)
            return generateMockResult(modelName, operation as PrismaOperation, args)
          }

          // For unknown operations, default to executing normally
          console.warn(`⚠️  Unknown operation '${operation}' on model '${modelName}' - executing normally`)
          return realPrisma[modelName][operation](args)
        }
      }
    })
  }

  // List of all Prisma models from your schema
  const models = [
    'activatorLog',
    'chaserLog',
    'spot',
    'summit',
    'alert',
  ]

  // Create the stub client with proxies for each model
  const stub: any = {}

  models.forEach(modelName => {
    stub[modelName] = createModelProxy(modelName)
  })

  // Add $disconnect method - execute normally
  stub.$disconnect = async () => {
    return realPrisma.$disconnect()
  }

  // Add $connect method - execute normally
  stub.$connect = async () => {
    return realPrisma.$connect()
  }

  console.log('🔧 STUB MODE: Mutations will be logged (not executed), reads will execute normally')

  return stub
}
