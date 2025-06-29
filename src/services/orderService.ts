import { Order, OrderStatus, OrderType, OrderSubmission, WebSocketMessage } from '../types';
import { MockDexRouter } from './dexRouter';
import { Database } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocketManager';

export class OrderService {
  private dexRouter: MockDexRouter;
  private database: Database;
  private wsManager: WebSocketManager;
  private retryAttempts = new Map<string, number>();

  constructor(database: Database, wsManager: WebSocketManager) {
    this.dexRouter = new MockDexRouter();
    this.database = database;
    this.wsManager = wsManager;
  }

  async submitOrder(orderData: OrderSubmission): Promise<string> {
    const orderId = uuidv4();
    
    const order: Order = {
      id: orderId,
      type: orderData.type,
      tokenIn: orderData.tokenIn,
      tokenOut: orderData.tokenOut,
      amountIn: orderData.amountIn,
      amountOut: orderData.amountOut,
      targetPrice: orderData.targetPrice,
      launchTime: orderData.launchTime ? new Date(orderData.launchTime) : undefined,
      slippage: orderData.slippage || 0.01,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: orderData.userId
    };

    // Save initial order
    await this.database.saveOrder(order);
    
    // Send initial WebSocket message
    this.sendWebSocketUpdate(order);

    console.log(`Order ${orderId} submitted: ${order.type} ${order.amountIn} ${order.tokenIn} -> ${order.tokenOut}`);

    return orderId;
  }

  async processOrder(orderId: string): Promise<void> {
    try {
      const order = await this.database.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Check if this is a retry
      const attempts = this.retryAttempts.get(orderId) || 0;
      if (attempts >= 3) {
        await this.failOrder(order, 'Maximum retry attempts exceeded');
        return;
      }

      // Update status to routing
      await this.updateOrderStatus(order, OrderStatus.ROUTING);

      // Route order based on type
      switch (order.type) {
        case OrderType.MARKET:
          await this.processMarketOrder(order);
          break;
        case OrderType.LIMIT:
          await this.processLimitOrder(order);
          break;
        case OrderType.SNIPER:
          await this.processSniperOrder(order);
          break;
        default:
          throw new Error(`Unsupported order type: ${order.type}`);
      }

    } catch (error) {
      console.error(`Error processing order ${orderId}:`, error);
      const order = await this.database.getOrder(orderId);
      if (order) {
        await this.handleOrderError(order, error as Error);
      }
    }
  }

  private async processMarketOrder(order: Order): Promise<void> {
    console.log(`Processing market order ${order.id}`);

    // Get best quote from DEXs
    const { bestQuote, allQuotes } = await this.dexRouter.getBestQuote(
      order.tokenIn, 
      order.tokenOut, 
      order.amountIn
    );

    // Update status to building
    await this.updateOrderStatus(order, OrderStatus.BUILDING, {
      quotes: allQuotes,
      dexProvider: bestQuote.provider
    });

    // Update status to submitted
    await this.updateOrderStatus(order, OrderStatus.SUBMITTED);

    // Execute the swap
    const result = await this.dexRouter.executeSwap(order, bestQuote);

    if (result.success) {
      // Update order with execution results
      order.txHash = result.txHash;
      order.executedPrice = result.executedPrice;
      order.dexProvider = bestQuote.provider;
      order.updatedAt = new Date();

      await this.updateOrderStatus(order, OrderStatus.CONFIRMED, {
        txHash: result.txHash,
        executedPrice: result.executedPrice,
        amountOut: result.amountOut,
        dexProvider: bestQuote.provider
      });

      console.log(`Market order ${order.id} executed successfully on ${bestQuote.provider}`);
    } else {
      throw new Error(result.error || 'Execution failed');
    }
  }

  private async processLimitOrder(order: Order): Promise<void> {
    console.log(`Processing limit order ${order.id}`);

    if (!order.targetPrice) {
      throw new Error('Target price is required for limit orders');
    }

    // Get current market price
    const { bestQuote } = await this.dexRouter.getBestQuote(
      order.tokenIn, 
      order.tokenOut, 
      order.amountIn
    );

    const currentPrice = bestQuote.amountOut / order.amountIn;

    // Check if target price is met
    if (currentPrice >= order.targetPrice) {
      console.log(`Limit order ${order.id} target price met: ${currentPrice.toFixed(4)} >= ${order.targetPrice}`);
      // Process as market order
      await this.processMarketOrder(order);
    } else {
      console.log(`Limit order ${order.id} target price not met: ${currentPrice.toFixed(4)} < ${order.targetPrice}`);
      // Re-queue for later processing
      throw new Error('Target price not reached yet');
    }
  }

  private async processSniperOrder(order: Order): Promise<void> {
    console.log(`Processing sniper order ${order.id}`);

    if (!order.launchTime) {
      throw new Error('Launch time is required for sniper orders');
    }

    const now = new Date();
    const launchTime = new Date(order.launchTime);

    // Check if launch time has been reached
    if (now >= launchTime) {
      console.log(`Sniper order ${order.id} launch time reached`);
      // Process as market order with higher priority
      await this.processMarketOrder(order);
    } else {
      const timeToLaunch = launchTime.getTime() - now.getTime();
      console.log(`Sniper order ${order.id} waiting for launch time (${timeToLaunch}ms remaining)`);
      // Re-queue for later processing
      throw new Error('Launch time not reached yet');
    }
  }

  private async updateOrderStatus(
    order: Order, 
    status: OrderStatus, 
    additionalData?: any
  ): Promise<void> {
    order.status = status;
    order.updatedAt = new Date();
    
    await this.database.saveOrder(order);
    this.sendWebSocketUpdate(order, additionalData);
  }

  private async failOrder(order: Order, error: string): Promise<void> {
    order.status = OrderStatus.FAILED;
    order.errorMessage = error;
    order.updatedAt = new Date();
    
    await this.database.saveOrder(order);
    this.sendWebSocketUpdate(order, { error });
    
    console.log(`Order ${order.id} failed: ${error}`);
  }

  private async handleOrderError(order: Order, error: Error): Promise<void> {
    const attempts = this.retryAttempts.get(order.id) || 0;
    this.retryAttempts.set(order.id, attempts + 1);

    if (attempts < 2) {
      // Retry with exponential backoff
      const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s
      console.log(`Retrying order ${order.id} in ${delay}ms (attempt ${attempts + 2}/3)`);
      
      setTimeout(() => {
        this.processOrder(order.id);
      }, delay);
    } else {
      await this.failOrder(order, error.message);
    }
  }

  private sendWebSocketUpdate(order: Order, additionalData?: any): void {
    const message: WebSocketMessage = {
      orderId: order.id,
      status: order.status,
      timestamp: new Date(),
      data: {
        txHash: order.txHash,
        executedPrice: order.executedPrice,
        error: order.errorMessage,
        dexProvider: order.dexProvider,
        ...additionalData
      }
    };

    this.wsManager.broadcast(order.id, message);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return await this.database.getOrder(orderId);
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    return await this.database.getRecentOrders(limit);
  }
}
