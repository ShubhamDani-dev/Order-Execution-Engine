import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/orderService';
import { OrderQueue } from '../queues/orderQueue';
import { WebSocketManager } from '../services/websocketManager';
import { validateOrderSubmission, validateOrderId } from '../utils/validation';
import { OrderSubmission, OrderType } from '../types';

export async function orderRoutes(
  fastify: FastifyInstance,
  orderService: OrderService,
  orderQueue: OrderQueue,
  wsManager: WebSocketManager
) {
  // POST /api/orders/submit - Submit order via HTTP
  fastify.post('/api/orders/submit', async (request: FastifyRequest<{
    Body: OrderSubmission
  }>, reply: FastifyReply) => {
    try {
      const { error, value } = validateOrderSubmission(request.body);
      if (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
      }

      const orderData: OrderSubmission = value;
      const orderId = await orderService.submitOrder(orderData);

      let priority = 0;
      if (orderData.type === OrderType.SNIPER) {
        priority = 10;
      } else if (orderData.type === OrderType.LIMIT) {
        priority = 5;
      }

      await orderQueue.addOrder(orderId, priority);

      return reply.send({
        orderId,
        message: 'Order submitted successfully'
      });

    } catch (error) {
      console.error('Order submission error:', error);
      return reply.status(500).send({
        error: 'Failed to process order',
        message: (error as Error).message
      });
    }
  });

  // POST /api/orders/execute - Required endpoint with WebSocket URL
  fastify.post('/api/orders/execute', async (request: FastifyRequest<{
    Body: OrderSubmission
  }>, reply: FastifyReply) => {
    try {
      const { error, value } = validateOrderSubmission(request.body);
      if (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
      }

      const orderData: OrderSubmission = value;
      const orderId = await orderService.submitOrder(orderData);

      let priority = 0;
      if (orderData.type === OrderType.SNIPER) {
        priority = 10;
      } else if (orderData.type === OrderType.LIMIT) {
        priority = 5;
      }

      await orderQueue.addOrder(orderId, priority);

      return reply.send({
        orderId,
        message: 'Order submitted successfully',
        websocketUrl: `/ws/orders/${orderId}`,
        status: 'pending'
      });

    } catch (error) {
      console.error('Order execution error:', error);
      return reply.status(500).send({
        error: 'Failed to process order',
        message: (error as Error).message
      });
    }
  });

  // GET /api/orders/:orderId - Get order details
  fastify.get('/api/orders/:orderId', async (request: FastifyRequest<{
    Params: { orderId: string }
  }>, reply: FastifyReply) => {
    try {
      const { error } = validateOrderId(request.params);
      if (error) {
        return reply.status(400).send({
          error: 'Invalid order ID',
          details: error.details.map(d => d.message)
        });
      }

      const order = await orderService.getOrder(request.params.orderId);
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      return reply.send(order);
    } catch (error) {
      console.error('Get order error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  });

  // GET /api/orders - Get recent orders
  fastify.get('/api/orders', async (request: FastifyRequest<{
    Querystring: { limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const limit = parseInt(request.query.limit || '50');
      const orders = await orderService.getRecentOrders(limit);
      return reply.send(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  });

  // GET /api/queue/stats - Get queue statistics
  fastify.get('/api/queue/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await orderQueue.getQueueStats();
      const wsConnections = wsManager.getConnectionCount();
      
      return reply.send({
        queue: stats,
        websockets: {
          totalConnections: wsConnections
        }
      });
    } catch (error) {
      console.error('Queue stats error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  });

  // POST /api/queue/pause - Pause queue processing
  fastify.post('/api/queue/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await orderQueue.pauseQueue();
      return reply.send({ message: 'Queue paused' });
    } catch (error) {
      console.error('Pause queue error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  });

  // POST /api/queue/resume - Resume queue processing
  fastify.post('/api/queue/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await orderQueue.resumeQueue();
      return reply.send({ message: 'Queue resumed' });
    } catch (error) {
      console.error('Resume queue error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  });
}
