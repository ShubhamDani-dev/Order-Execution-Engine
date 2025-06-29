import { OrderService } from '../src/services/orderService';
import { Database } from '../src/models/database';
import { WebSocketManager } from '../src/services/websocketManager';
import { OrderType, OrderStatus, OrderSubmission } from '../src/types';

// Mock the dependencies
jest.mock('../src/models/database');
jest.mock('../src/services/websocketManager');

describe('OrderService', () => {
  let orderService: OrderService;
  let mockDatabase: jest.Mocked<Database>;
  let mockWsManager: jest.Mocked<WebSocketManager>;

  beforeEach(() => {
    mockDatabase = new Database() as jest.Mocked<Database>;
    mockWsManager = {} as jest.Mocked<WebSocketManager>;
    mockWsManager.broadcast = jest.fn();
    
    orderService = new OrderService(mockDatabase, mockWsManager);
  });

  describe('submitOrder', () => {
    it('should create and save a market order', async () => {
      const orderData: OrderSubmission = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        userId: 'user1'
      };

      mockDatabase.saveOrder = jest.fn().mockResolvedValue(undefined);

      const orderId = await orderService.submitOrder(orderData);

      expect(orderId).toBeDefined();
      expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockDatabase.saveOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: orderId,
          type: OrderType.MARKET,
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
          slippage: 0.01,
          status: OrderStatus.PENDING,
          userId: 'user1'
        })
      );
      expect(mockWsManager.broadcast).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          orderId,
          status: OrderStatus.PENDING
        })
      );
    });

    it('should create a limit order with target price', async () => {
      const orderData: OrderSubmission = {
        type: OrderType.LIMIT,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        targetPrice: 105,
        slippage: 0.01
      };

      mockDatabase.saveOrder = jest.fn().mockResolvedValue(undefined);

      const orderId = await orderService.submitOrder(orderData);

      expect(mockDatabase.saveOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderType.LIMIT,
          targetPrice: 105
        })
      );
    });

    it('should create a sniper order with launch time', async () => {
      const launchTime = new Date(Date.now() + 60000); // 1 minute from now
      const orderData: OrderSubmission = {
        type: OrderType.SNIPER,
        tokenIn: 'SOL',
        tokenOut: 'NEW_TOKEN',
        amountIn: 100,
        launchTime: launchTime.toISOString(),
        slippage: 0.05
      };

      mockDatabase.saveOrder = jest.fn().mockResolvedValue(undefined);

      const orderId = await orderService.submitOrder(orderData);

      expect(mockDatabase.saveOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderType.SNIPER,
          launchTime: launchTime
        })
      );
    });
  });

  describe('getOrder', () => {
    it('should retrieve an order by ID', async () => {
      const mockOrder = {
        id: 'test-order-1',
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        status: OrderStatus.CONFIRMED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDatabase.getOrder = jest.fn().mockResolvedValue(mockOrder);

      const result = await orderService.getOrder('test-order-1');

      expect(result).toEqual(mockOrder);
      expect(mockDatabase.getOrder).toHaveBeenCalledWith('test-order-1');
    });

    it('should return null for non-existent order', async () => {
      mockDatabase.getOrder = jest.fn().mockResolvedValue(null);

      const result = await orderService.getOrder('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getRecentOrders', () => {
    it('should retrieve recent orders with default limit', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          type: OrderType.MARKET,
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
          slippage: 0.01,
          status: OrderStatus.CONFIRMED,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDatabase.getRecentOrders = jest.fn().mockResolvedValue(mockOrders);

      const result = await orderService.getRecentOrders();

      expect(result).toEqual(mockOrders);
      expect(mockDatabase.getRecentOrders).toHaveBeenCalledWith(50);
    });

    it('should retrieve recent orders with custom limit', async () => {
      mockDatabase.getRecentOrders = jest.fn().mockResolvedValue([]);

      await orderService.getRecentOrders(10);

      expect(mockDatabase.getRecentOrders).toHaveBeenCalledWith(10);
    });
  });
});
