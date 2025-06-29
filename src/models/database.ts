import { Pool } from 'pg';
import { config } from '../config';
import { Order, OrderStatus, OrderType, DexProvider } from '../types';

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
    });
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          token_in VARCHAR(100) NOT NULL,
          token_out VARCHAR(100) NOT NULL,
          amount_in DECIMAL NOT NULL,
          amount_out DECIMAL,
          target_price DECIMAL,
          launch_time TIMESTAMP,
          slippage DECIMAL NOT NULL,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          user_id VARCHAR(100),
          tx_hash VARCHAR(200),
          executed_price DECIMAL,
          error_message TEXT,
          dex_provider VARCHAR(20)
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      `);

      console.log('Database initialized');
    } finally {
      client.release();
    }
  }

  async saveOrder(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO orders (
          id, type, token_in, token_out, amount_in, amount_out, target_price,
          launch_time, slippage, status, created_at, updated_at, user_id,
          tx_hash, executed_price, error_message, dex_provider
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          tx_hash = EXCLUDED.tx_hash,
          executed_price = EXCLUDED.executed_price,
          error_message = EXCLUDED.error_message,
          dex_provider = EXCLUDED.dex_provider
      `, [
        order.id, order.type, order.tokenIn, order.tokenOut, order.amountIn,
        order.amountOut, order.targetPrice, order.launchTime, order.slippage,
        order.status, order.createdAt, order.updatedAt, order.userId,
        order.txHash, order.executedPrice, order.errorMessage, order.dexProvider
      ]);
    } finally {
      client.release();
    }
  }

  async getOrder(id: string): Promise<Order | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type as OrderType,
        tokenIn: row.token_in,
        tokenOut: row.token_out,
        amountIn: parseFloat(row.amount_in),
        amountOut: row.amount_out ? parseFloat(row.amount_out) : undefined,
        targetPrice: row.target_price ? parseFloat(row.target_price) : undefined,
        launchTime: row.launch_time,
        slippage: parseFloat(row.slippage),
        status: row.status as OrderStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        txHash: row.tx_hash,
        executedPrice: row.executed_price ? parseFloat(row.executed_price) : undefined,
        errorMessage: row.error_message,
        dexProvider: row.dex_provider as DexProvider
      };
    } finally {
      client.release();
    }
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        type: row.type as OrderType,
        tokenIn: row.token_in,
        tokenOut: row.token_out,
        amountIn: parseFloat(row.amount_in),
        amountOut: row.amount_out ? parseFloat(row.amount_out) : undefined,
        targetPrice: row.target_price ? parseFloat(row.target_price) : undefined,
        launchTime: row.launch_time,
        slippage: parseFloat(row.slippage),
        status: row.status as OrderStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        txHash: row.tx_hash,
        executedPrice: row.executed_price ? parseFloat(row.executed_price) : undefined,
        errorMessage: row.error_message,
        dexProvider: row.dex_provider as DexProvider
      }));
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
