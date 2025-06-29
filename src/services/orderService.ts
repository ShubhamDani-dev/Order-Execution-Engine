import { Order, OrderStatus, OrderType, OrderSubmission, WebSocketMessage } from '../types';
import { MockDexRouter } from './dexRouter';
import { Database } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocketManager';

export class OrderService {
  private dexRouter: MockDexRouter;
  private db: Database;
  private ws: WebSocketManager;
  private retries = new Map<string, number>();

  constructor(db: Database, ws: WebSocketManager) {
    this.dexRouter = new MockDexRouter();
    this.db = db;
    this.ws = ws;
  }

  async submitOrder(data: OrderSubmission): Promise<string> {
    const id = uuidv4();
    
    const order: Order = {
      id,
      type: data.type,
      tokenIn: data.tokenIn,
      tokenOut: data.tokenOut,
      amountIn: data.amountIn,
      amountOut: data.amountOut,
      targetPrice: data.targetPrice,
      launchTime: data.launchTime ? new Date(data.launchTime) : undefined,
      slippage: data.slippage || 0.01,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: data.userId
    };

    await this.db.saveOrder(order);
    this.sendUpdate(order);

    console.log(`Order ${id} submitted: ${order.type} ${order.amountIn} ${order.tokenIn} -> ${order.tokenOut}`);

    return id;
  }

  async processOrder(orderId: string): Promise<void> {
    try {
      const order = await this.db.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const attempts = this.retries.get(orderId) || 0;
      if (attempts >= 3) {
        await this.failOrder(order, 'Max retries exceeded');
        return;
      }

      await this.updateStatus(order, OrderStatus.ROUTING);

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
          throw new Error(`Unknown order type: ${order.type}`);
      }

    } catch (error) {
      console.error(`Error processing order ${orderId}:`, error);
      const order = await this.db.getOrder(orderId);
      if (order) {
        await this.handleError(order, error as Error);
      }
    }
  }

  private async processMarketOrder(order: Order): Promise<void> {
    console.log(`Processing market order ${order.id}`);

    const { bestQuote, allQuotes } = await this.dexRouter.getBestQuote(
      order.tokenIn, 
      order.tokenOut, 
      order.amountIn
    );

    await this.updateStatus(order, OrderStatus.BUILDING, {
      quotes: allQuotes,
      dexProvider: bestQuote.provider
    });

    await this.updateStatus(order, OrderStatus.SUBMITTED);

    const result = await this.dexRouter.executeSwap(order, bestQuote);

    if (result.success) {
      if (result.txHash) order.txHash = result.txHash;
      if (result.executedPrice) order.executedPrice = result.executedPrice;
      order.dexProvider = bestQuote.provider;
      order.updatedAt = new Date();

      await this.updateStatus(order, OrderStatus.CONFIRMED, {
        txHash: result.txHash,
        executedPrice: result.executedPrice,
        amountOut: result.amountOut,
        dexProvider: bestQuote.provider
      });

      console.log(`Market order ${order.id} executed on ${bestQuote.provider}`);
    } else {
      throw new Error(result.error || 'Execution failed');
    }
  }

  private async processLimitOrder(order: Order): Promise<void> {
    console.log(`Processing limit order ${order.id}`);

    if (!order.targetPrice) {
      throw new Error('Target price required for limit orders');
    }

    const { bestQuote } = await this.dexRouter.getBestQuote(
      order.tokenIn, 
      order.tokenOut, 
      order.amountIn
    );

    const currentPrice = bestQuote.amountOut / order.amountIn;

    if (currentPrice >= order.targetPrice) {
      console.log(`Limit order ${order.id} target met: ${currentPrice.toFixed(4)} >= ${order.targetPrice}`);
      await this.processMarketOrder(order);
    } else {
      console.log(`Limit order ${order.id} waiting: ${currentPrice.toFixed(4)} < ${order.targetPrice}`);
      throw new Error('Target price not reached');
    }
  }

  private async processSniperOrder(order: Order): Promise<void> {
    console.log(`Processing sniper order ${order.id}`);

    if (!order.launchTime) {
      throw new Error('Launch time required for sniper orders');
    }

    const now = new Date();
    const launchTime = new Date(order.launchTime);

    if (now >= launchTime) {
      console.log(`Sniper order ${order.id} launching`);
      await this.processMarketOrder(order);
    } else {
      const timeLeft = launchTime.getTime() - now.getTime();
      console.log(`Sniper order ${order.id} waiting ${timeLeft}ms`);
      throw new Error('Launch time not reached');
    }
  }

  private async updateStatus(order: Order, status: OrderStatus, data?: any): Promise<void> {
    order.status = status;
    order.updatedAt = new Date();
    
    await this.db.saveOrder(order);
    this.sendUpdate(order, data);
  }

  private async failOrder(order: Order, error: string): Promise<void> {
    order.status = OrderStatus.FAILED;
    order.errorMessage = error;
    order.updatedAt = new Date();
    
    await this.db.saveOrder(order);
    this.sendUpdate(order, { error });
  }

  private async handleError(order: Order, error: Error): Promise<void> {
    const attempts = this.retries.get(order.id) || 0;
    this.retries.set(order.id, attempts + 1);

    if (attempts >= 2) {
      await this.failOrder(order, error.message);
    } else {
      console.log(`Retrying order ${order.id} (attempt ${attempts + 1})`);
      throw error; // Re-throw to trigger retry
    }
  }

  private sendUpdate(order: Order, data?: any): void {
    const message: WebSocketMessage = {
      orderId: order.id,
      status: order.status,
      timestamp: new Date(),
      data: {
        txHash: order.txHash,
        executedPrice: order.executedPrice,
        error: order.errorMessage,
        dexProvider: order.dexProvider,
        ...data
      }
    };

    this.ws.broadcast(order.id, message);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.db.getOrder(orderId);
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    return this.db.getRecentOrders(limit);
  }
}
