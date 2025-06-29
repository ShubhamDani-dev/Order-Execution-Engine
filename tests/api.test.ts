import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { OrderType } from '../src/types';
import { OrderService } from '../src/services/orderService';
import { OrderQueue } from '../src/queues/orderQueue';
import { WebSocketManager } from '../src/services/websocketManager';
import { orderRoutes } from '../src/routes/orders';
import { MockDatabase } from './mockDatabase';

// Mock the real dependencies
jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('../src/models/database');

describe('Order API Integration Tests', () => {
  let app: FastifyInstance;
  let mockDatabase: MockDatabase;
  let orderService: OrderService;
  let mockOrderQueue: any;

  beforeAll(async () => {
    // Create Fastify instance
    app = Fastify({ logger: false });

    // Register CORS
    await app.register(cors, {
      origin: true,
      credentials: true
    });

    // Initialize mock database
    mockDatabase = new MockDatabase();
    await mockDatabase.init();

    // Initialize services with mocks
    const wsManager = new WebSocketManager(app);
    orderService = new OrderService(mockDatabase as any, wsManager);
    
    // Mock the queue
    mockOrderQueue = {
      addOrder: jest.fn().mockResolvedValue(undefined),
      getQueueStats: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      }),
      pauseQueue: jest.fn().mockResolvedValue(undefined),
      resumeQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Register routes
    await orderRoutes(app, orderService, mockOrderQueue, wsManager);

    // Health check endpoint
    app.get('/health', async (request, reply) => {
      const queueStats = await mockOrderQueue.getQueueStats();
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

    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/orders/submit', () => {
    it('should submit a valid market order', async () => {
      const orderData = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        userId: 'test-user'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toMatchObject({
        orderId: expect.any(String),
        message: 'Order submitted successfully'
      });
      expect(result.orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should submit a valid limit order', async () => {
      const orderData = {
        type: OrderType.LIMIT,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        targetPrice: 105,
        slippage: 0.01
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.orderId).toBeDefined();
    });

    it('should submit a valid sniper order', async () => {
      const launchTime = new Date(Date.now() + 60000).toISOString();
      const orderData = {
        type: OrderType.SNIPER,
        tokenIn: 'SOL',
        tokenOut: 'NEW_TOKEN',
        amountIn: 100,
        launchTime,
        slippage: 0.05
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.orderId).toBeDefined();
    });

    it('should reject invalid order data', async () => {
      const invalidOrderData = {
        type: 'INVALID_TYPE',
        tokenIn: 'SOL',
        amountIn: -100 // negative amount
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: invalidOrderData
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toBeInstanceOf(Array);
    });

    it('should require target price for limit orders', async () => {
      const orderData = {
        type: OrderType.LIMIT,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100
        // missing targetPrice
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require launch time for sniper orders', async () => {
      const orderData = {
        type: OrderType.SNIPER,
        tokenIn: 'SOL',
        tokenOut: 'NEW_TOKEN',
        amountIn: 100
        // missing launchTime
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/orders/:orderId', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Create a test order first
      const orderData = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/submit',
        payload: orderData
      });

      const result = JSON.parse(response.payload);
      testOrderId = result.orderId;
    });

    it('should retrieve an existing order', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${testOrderId}`
      });

      expect(response.statusCode).toBe(200);
      const order = JSON.parse(response.payload);
      expect(order).toMatchObject({
        id: testOrderId,
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100
      });
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${fakeOrderId}`
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Order not found');
    });

    it('should return 400 for invalid order ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/invalid-id'
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Invalid order ID');
    });
  });

  describe('GET /api/orders', () => {
    it('should retrieve recent orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders'
      });

      expect(response.statusCode).toBe(200);
      const orders = JSON.parse(response.payload);
      expect(Array.isArray(orders)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders?limit=5'
      });

      expect(response.statusCode).toBe(200);
      const orders = JSON.parse(response.payload);
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue/stats'
      });

      expect(response.statusCode).toBe(200);
      const stats = JSON.parse(response.payload);
      expect(stats).toMatchObject({
        queue: {
          waiting: expect.any(Number),
          active: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
          delayed: expect.any(Number)
        },
        websockets: {
          totalConnections: expect.any(Number)
        }
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const health = JSON.parse(response.payload);
      expect(health).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: '1.0.0',
        queue: expect.any(Object),
        websockets: expect.any(Object)
      });
    });
  });
});
