import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config';
import { Database } from './models/database';
import { OrderService } from './services/orderService';
import { OrderQueue } from './queues/orderQueue';
import { WebSocketManager } from './services/websocketManager';
import { orderRoutes } from './routes/orders';
import { websocketRoutes } from './routes/websocket';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.server.nodeEnv === 'production' ? 'info' : 'debug'
    }
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Initialize database
  const database = new Database();
  await database.init();

  // Initialize services
  const wsManager = new WebSocketManager(fastify);
  const orderService = new OrderService(database, wsManager);
  const orderQueue = new OrderQueue(orderService);

  // Register routes
  await orderRoutes(fastify, orderService, orderQueue, wsManager);
  await websocketRoutes(fastify, wsManager);

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const queueStats = await orderQueue.getQueueStats();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      queue: queueStats,
      websockets: {
        connections: wsManager.getConnectionCount()
      }
    };
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down server...');
    await orderQueue.close();
    await database.close();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    
    await fastify.listen({
      port: config.server.port,
      host: '0.0.0.0'
    });

    console.log(`
🚀 Solana Order Execution Engine started!
📡 Server running on port ${config.server.port}
🗄️  Database: ${config.database.host}:${config.database.port}
🔴 Redis: ${config.redis.host}:${config.redis.port}
📊 API endpoints:
   POST /api/orders/submit
   GET  /api/orders/:orderId  
   GET  /api/orders
   GET  /api/queue/stats
   GET  /health
    `);

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildServer };
