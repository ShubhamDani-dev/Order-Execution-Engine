import { FastifyInstance } from 'fastify';
import { WebSocketManager } from '../services/websocketManager';

export async function websocketRoutes(
  fastify: FastifyInstance,
  wsManager: WebSocketManager
) {
  // WebSocket endpoint for order status updates
  await fastify.register(async function (fastify) {
    fastify.get('/ws/orders/:orderId', { websocket: true }, async (connection, req) => {
      const orderId = (req.params as any).orderId;
      
      // Register WebSocket connection for this order
      wsManager.registerConnection(orderId, connection);
      
      // Send initial connection confirmation
      connection.send(JSON.stringify({
        type: 'connected',
        orderId,
        message: 'WebSocket connected for order updates',
        timestamp: new Date().toISOString()
      }));

      // Handle connection close
      connection.on('close', () => {
        wsManager.unregisterConnection(orderId, connection);
      });

      // Handle incoming messages (optional)
      connection.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`WS message from client for order ${orderId}:`, data);
        } catch (error) {
          console.error('Invalid WS message:', error);
        }
      });
    });
  });
}
