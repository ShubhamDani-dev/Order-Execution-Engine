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

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(websocket);

  const database = new Database();
  await database.init();

  const wsManager = new WebSocketManager(fastify);
  const orderService = new OrderService(database, wsManager);
  const orderQueue = new OrderQueue(orderService);

  await orderRoutes(fastify, orderService, orderQueue, wsManager);
  await websocketRoutes(fastify, wsManager);

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

  const shutdown = async () => {
    console.log('Shutting down...');
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

    console.log(`Server running on port ${config.server.port}`);
    console.log(`Database: ${config.database.host}:${config.database.port}`);
    console.log(`Redis: ${config.redis.host}:${config.redis.port}`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildServer };
