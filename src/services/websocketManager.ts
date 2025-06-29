import { FastifyInstance } from 'fastify';
import { WebSocketMessage } from '../types';

export class WebSocketManager {
  private connections = new Map<string, Set<any>>();
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  registerConnection(orderId: string, socket: any): void {
    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }
    this.connections.get(orderId)!.add(socket);

    socket.on('close', () => {
      this.unregisterConnection(orderId, socket);
    });

    console.log(`WS connected for order ${orderId}`);
  }

  unregisterConnection(orderId: string, socket: any): void {
    const orderConnections = this.connections.get(orderId);
    if (orderConnections) {
      orderConnections.delete(socket);
      if (orderConnections.size === 0) {
        this.connections.delete(orderId);
      }
    }
    console.log(`WS disconnected for order ${orderId}`);
  }

  broadcast(orderId: string, message: WebSocketMessage): void {
    const orderConnections = this.connections.get(orderId);
    if (orderConnections) {
      const messageStr = JSON.stringify(message);
      orderConnections.forEach(socket => {
        try {
          if (socket && socket.readyState === 1) {
            socket.send(messageStr);
          }
        } catch (error) {
          console.error(`WS send error for order ${orderId}:`, error);
          this.unregisterConnection(orderId, socket);
        }
      });
      console.log(`Broadcasted to ${orderConnections.size} connection(s) for order ${orderId}: ${message.status}`);
    }
  }

  getConnectionCount(orderId?: string): number {
    if (orderId) {
      return this.connections.get(orderId)?.size || 0;
    }
    let total = 0;
    this.connections.forEach(connections => {
      total += connections.size;
    });
    return total;
  }

  getAllConnections(): Map<string, Set<any>> {
    return this.connections;
  }
}
