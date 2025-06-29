import { Order, OrderStatus, OrderType, DexProvider } from '../src/types';

export class MockDatabase {
  private orders = new Map<string, Order>();

  async init(): Promise<void> {
    // Mock initialization
    console.log('Mock database initialized');
  }

  async saveOrder(order: Order): Promise<void> {
    this.orders.set(order.id, { ...order });
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values());
    return allOrders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async close(): Promise<void> {
    this.orders.clear();
  }
}
