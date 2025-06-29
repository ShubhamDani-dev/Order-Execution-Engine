import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { OrderService } from '../services/orderService';
import IORedis from 'ioredis';

export class OrderQueue {
  private queue: Queue;
  private worker: Worker;
  private redis: IORedis;
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
    
    // Create Redis connection
    this.redis = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    // Create queue
    this.queue = new Queue('order-processing', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create worker
    this.worker = new Worker(
      'order-processing',
      async (job: Job) => {
        const { orderId } = job.data;
        console.log(`Processing order ${orderId} (Job ID: ${job.id})`);
        await this.orderService.processOrder(orderId);
      },
      {
        connection: this.redis,
        concurrency: config.queue.maxConcurrentOrders,
        limiter: {
          max: config.queue.ordersPerMinute,
          duration: 60 * 1000, // 1 minute
        },
      }
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      console.log(`Order processing completed for job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Order processing failed for job ${job?.id}:`, err.message);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Order processing stalled for job ${jobId}`);
    });

    this.queue.on('error', (err) => {
      console.error('Queue error:', err);
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  async addOrder(orderId: string, priority: number = 0): Promise<void> {
    try {
      await this.queue.add(
        'process-order',
        { orderId },
        {
          priority, // Higher priority for sniper orders
          delay: 0,
        }
      );
      console.log(`Order ${orderId} added to queue with priority ${priority}`);
    } catch (error) {
      console.error(`Failed to add order ${orderId} to queue:`, error);
      throw error;
    }
  }

  async addDelayedOrder(orderId: string, delay: number): Promise<void> {
    try {
      await this.queue.add(
        'process-order',
        { orderId },
        {
          delay,
        }
      );
      console.log(`Order ${orderId} scheduled for processing in ${delay}ms`);
    } catch (error) {
      console.error(`Failed to schedule order ${orderId}:`, error);
      throw error;
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log('Queue resumed');
  }

  async clearQueue(): Promise<void> {
    await this.queue.drain();
    console.log('Queue cleared');
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
    console.log('Order queue closed');
  }
}
