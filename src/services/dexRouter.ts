import { DexQuote, DexProvider, ExecutionResult, Order } from '../types';
import { config } from '../config';

export class MockDexRouter {
  private basePrice = 100;

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await this.sleep(150 + Math.random() * 100);
    
    const variance = 0.98 + Math.random() * 0.04;
    const price = this.basePrice * variance;
    const fee = 0.003;
    const impact = amount > 1000 ? 0.001 + Math.random() * 0.003 : Math.random() * 0.001;
    
    return {
      provider: DexProvider.RAYDIUM,
      price,
      fee,
      amountOut: amount * price * (1 - fee - impact),
      priceImpact: impact,
      timestamp: new Date()
    };
  }

  async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await this.sleep(180 + Math.random() * 120);
    
    const variance = 0.97 + Math.random() * 0.05;
    const price = this.basePrice * variance;
    const fee = 0.002;
    const impact = amount > 1000 ? 0.0008 + Math.random() * 0.002 : Math.random() * 0.0008;
    
    return {
      provider: DexProvider.METEORA,
      price,
      fee,
      amountOut: amount * price * (1 - fee - impact),
      priceImpact: impact,
      timestamp: new Date()
    };
  }

  async getBestQuote(tokenIn: string, tokenOut: string, amount: number): Promise<{
    bestQuote: DexQuote;
    allQuotes: DexQuote[];
  }> {
    const [raydium, meteor] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);

    const quotes = [raydium, meteor];
    const best = quotes.reduce((a, b) => b.amountOut > a.amountOut ? b : a);

    console.log(`DEX routing: Raydium ${raydium.amountOut.toFixed(4)} (${(raydium.fee * 100).toFixed(2)}%), Meteora ${meteor.amountOut.toFixed(4)} (${(meteor.fee * 100).toFixed(2)}%) -> ${best.provider}`);

    return { bestQuote: best, allQuotes: quotes };
  }

  async executeSwap(order: Order, quote: DexQuote): Promise<ExecutionResult> {
    console.log(`Executing on ${quote.provider} for order ${order.id}`);
    
    const execTime = 2000 + Math.random() * 1000;
    await this.sleep(execTime);

    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Transaction failed due to network congestion'
      };
    }

    const slippage = Math.random() * order.slippage * 0.8;
    const finalAmount = quote.amountOut * (1 - slippage);
    const finalPrice = finalAmount / order.amountIn;

    return {
      success: true,
      txHash: this.generateTxHash(),
      executedPrice: finalPrice,
      amountOut: finalAmount,
      gasUsed: 50000 + Math.random() * 100000
    };
  }

  private generateTxHash(): string {
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

  updateMarketConditions(): void {
    const change = (Math.random() - 0.5) * 0.04;
    this.basePrice *= (1 + change);
    console.log(`Market update: base price ${this.basePrice.toFixed(4)}`);
  }
}

setInterval(() => {
  const router = new MockDexRouter();
  router.updateMarketConditions();
}, 30000);
