import { DexQuote, DexProvider, ExecutionResult, Order } from '../types';
import { config } from '../config';

export class MockDexRouter {
  private basePrice = 100; // Base price for simulation

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    // Simulate network delay
    await this.sleep(150 + Math.random() * 100);
    
    const variance = 0.98 + Math.random() * 0.04; // 98% - 102% of base price
    const price = this.basePrice * variance;
    const fee = 0.003; // 0.3% fee
    const priceImpact = amount > 1000 ? 0.001 + Math.random() * 0.003 : Math.random() * 0.001;
    
    return {
      provider: DexProvider.RAYDIUM,
      price,
      fee,
      amountOut: amount * price * (1 - fee - priceImpact),
      priceImpact,
      timestamp: new Date()
    };
  }

  async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    // Simulate network delay
    await this.sleep(180 + Math.random() * 120);
    
    const variance = 0.97 + Math.random() * 0.05; // 97% - 102% of base price
    const price = this.basePrice * variance;
    const fee = 0.002; // 0.2% fee (lower than Raydium)
    const priceImpact = amount > 1000 ? 0.0008 + Math.random() * 0.002 : Math.random() * 0.0008;
    
    return {
      provider: DexProvider.METEORA,
      price,
      fee,
      amountOut: amount * price * (1 - fee - priceImpact),
      priceImpact,
      timestamp: new Date()
    };
  }

  async getBestQuote(tokenIn: string, tokenOut: string, amount: number): Promise<{
    bestQuote: DexQuote;
    allQuotes: DexQuote[];
  }> {
    const [raydiumQuote, meteorQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);

    const allQuotes = [raydiumQuote, meteorQuote];
    const bestQuote = allQuotes.reduce((best, current) => 
      current.amountOut > best.amountOut ? current : best
    );

    console.log(`DEX Routing Decision:
      Raydium: ${raydiumQuote.amountOut.toFixed(4)} ${tokenOut} (fee: ${(raydiumQuote.fee * 100).toFixed(2)}%)
      Meteora: ${meteorQuote.amountOut.toFixed(4)} ${tokenOut} (fee: ${(meteorQuote.fee * 100).toFixed(2)}%)
      Best: ${bestQuote.provider} with ${bestQuote.amountOut.toFixed(4)} ${tokenOut}`);

    return { bestQuote, allQuotes };
  }

  async executeSwap(order: Order, quote: DexQuote): Promise<ExecutionResult> {
    console.log(`Executing swap on ${quote.provider} for order ${order.id}`);
    
    // Simulate execution time (2-3 seconds)
    const executionTime = 2000 + Math.random() * 1000;
    await this.sleep(executionTime);

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Transaction failed due to network congestion'
      };
    }

    // Calculate slippage impact
    const slippageImpact = Math.random() * order.slippage * 0.8; // Use up to 80% of allowed slippage
    const finalAmountOut = quote.amountOut * (1 - slippageImpact);
    const finalPrice = finalAmountOut / order.amountIn;

    return {
      success: true,
      txHash: this.generateMockTxHash(),
      executedPrice: finalPrice,
      amountOut: finalAmountOut,
      gasUsed: 50000 + Math.random() * 100000
    };
  }

  private generateMockTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Simulate market conditions changing
  updateMarketConditions(): void {
    // Randomly adjust base price by ±2%
    const change = (Math.random() - 0.5) * 0.04;
    this.basePrice *= (1 + change);
    console.log(`Market conditions updated: new base price ${this.basePrice.toFixed(4)}`);
  }
}

// Update market conditions every 30 seconds
setInterval(() => {
  const router = new MockDexRouter();
  router.updateMarketConditions();
}, 30000);
