import net from 'net'
import type { ClusterClient } from './types'
import {
  createClient,
  sendWelcome,
  sendPrompt,
  authenticateClient,
  cleanupClient
} from './client'
import { executeCommand, sendInitialSpots } from './commands'
import { SpotPoller } from './spotPoller'
import { logger } from '../logger'

export class ClusterServer {
  private server: net.Server
  private clients: Map<string, ClusterClient> = new Map()
  private spotPoller: SpotPoller
  private port: number

  constructor(port: number = 7300) {
    this.port = port
    this.spotPoller = new SpotPoller(this.clients)
    this.server = net.createServer(this.handleConnection.bind(this))

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error({ port: this.port }, `Cluster server port ${this.port} is already in use`)
      } else {
        logger.error({ error }, 'Cluster server error')
      }
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        logger.info({ port: this.port }, `Cluster server listening on port ${this.port}`)
        this.spotPoller.start()
        resolve()
      })

      this.server.once('error', reject)
    })
  }

  async stop(): Promise<void> {
    this.spotPoller.stop()

    // Disconnect all clients
    for (const client of this.clients.values()) {
      cleanupClient(client)
    }
    this.clients.clear()

    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Cluster server stopped')
        resolve()
      })
    })
  }

  private handleConnection(socket: net.Socket): void {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`
    const client = createClient(socket)

    this.clients.set(clientId, client)
    logger.info({ clientId }, 'New cluster connection')

    // Send welcome message
    sendWelcome(client)

    // Handle incoming data
    let buffer = ''
    const CTRL_C = '\x03'

    socket.on('data', async (data) => {
      const str = data.toString()

      // Check for Ctrl-C - disconnect immediately
      if (str.includes(CTRL_C)) {
        sendToClient(client, '\r\n73 de WOTA cluster. Goodbye!\r\n')
        cleanupClient(client)
        this.clients.delete(clientId)
        return
      }

      buffer += str

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, lineEnd).replace(/\r$/, '')
        buffer = buffer.substring(lineEnd + 1)

        await this.handleInput(client, clientId, line)
      }
    })

    socket.on('close', () => {
      cleanupClient(client)
      this.clients.delete(clientId)
    })

    socket.on('error', (error) => {
      logger.error({ error, clientId }, 'Client socket error')
      cleanupClient(client)
      this.clients.delete(clientId)
    })

    socket.on('timeout', () => {
      logger.info({ clientId }, 'Client socket timeout')
      cleanupClient(client)
      this.clients.delete(clientId)
    })

    // Set socket timeout (30 minutes)
    socket.setTimeout(30 * 60 * 1000)
  }

  private async handleInput(
    client: ClusterClient,
    clientId: string,
    input: string
  ): Promise<void> {
    // If not authenticated, treat input as callsign login
    if (!client.authenticated) {
      const success = authenticateClient(client, input)
      if (success) {
        // Send initial spots from cache and prompt
        sendInitialSpots(client)
        sendPrompt(client)
      }
      return
    }

    // Execute command
    const result = await executeCommand(client, input, this.clients)

    if (result.disconnect) {
      this.clients.delete(clientId)
    }
  }
}

export type { ClusterClient } from './types'
