import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/order_execution_db',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'order_execution_db',
    user: process.env.POSTGRES_USER || 'username',
    password: process.env.POSTGRES_PASSWORD || 'password'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null // Required for BullMQ
  },
  dex: {
    enableRealExecution: process.env.ENABLE_REAL_EXECUTION === 'true',
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.01'),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3')
  },
  queue: {
    maxConcurrentOrders: parseInt(process.env.MAX_CONCURRENT_ORDERS || '10'),
    ordersPerMinute: parseInt(process.env.ORDERS_PER_MINUTE || '100')
  }
};
