export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit', 
  SNIPER = 'sniper'
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export enum DexProvider {
  RAYDIUM = 'raydium',
  METEORA = 'meteora'
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut?: number | undefined; // For limit orders
  targetPrice?: number | undefined; // For limit orders
  launchTime?: Date | undefined; // For sniper orders
  slippage: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  userId?: string | undefined;
  txHash?: string | undefined;
  executedPrice?: number | undefined;
  errorMessage?: string | undefined;
  dexProvider?: DexProvider | undefined;
}

export interface DexQuote {
  provider: DexProvider;
  price: number;
  fee: number;
  amountOut: number;
  priceImpact: number;
  timestamp: Date;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  executedPrice?: number;
  amountOut?: number;
  error?: string;
  gasUsed?: number;
}

export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  data?: {
    txHash?: string;
    executedPrice?: number;
    amountOut?: number;
    error?: string;
    dexProvider?: DexProvider;
    quotes?: DexQuote[];
  };
}

export interface OrderSubmission {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut?: number;
  targetPrice?: number;
  launchTime?: string;
  slippage?: number;
  userId?: string;
}
