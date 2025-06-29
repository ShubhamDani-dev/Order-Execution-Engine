import { MockDexRouter } from '../src/services/dexRouter';
import { OrderType, DexProvider } from '../src/types';

describe('MockDexRouter', () => {
  let dexRouter: MockDexRouter;

  beforeEach(() => {
    dexRouter = new MockDexRouter();
  });

  describe('getRaydiumQuote', () => {
    it('should return a valid quote for Raydium', async () => {
      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);

      expect(quote).toMatchObject({
        provider: DexProvider.RAYDIUM,
        price: expect.any(Number),
        fee: 0.003,
        amountOut: expect.any(Number),
        priceImpact: expect.any(Number),
        timestamp: expect.any(Date)
      });

      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
    });

    it('should have higher price impact for larger amounts', async () => {
      const smallQuote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);
      const largeQuote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 2000);

      expect(largeQuote.priceImpact).toBeGreaterThanOrEqual(smallQuote.priceImpact);
    });
  });

  describe('getMeteorQuote', () => {
    it('should return a valid quote for Meteora', async () => {
      const quote = await dexRouter.getMeteorQuote('SOL', 'USDC', 100);

      expect(quote).toMatchObject({
        provider: DexProvider.METEORA,
        price: expect.any(Number),
        fee: 0.002,
        amountOut: expect.any(Number),
        priceImpact: expect.any(Number),
        timestamp: expect.any(Date)
      });

      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
    });

    it('should have lower fees than Raydium', async () => {
      const meteoraQuote = await dexRouter.getMeteorQuote('SOL', 'USDC', 100);
      expect(meteoraQuote.fee).toBe(0.002);
    });
  });

  describe('getBestQuote', () => {
    it('should return the best quote between DEXs', async () => {
      const result = await dexRouter.getBestQuote('SOL', 'USDC', 100);

      expect(result.allQuotes).toHaveLength(2);
      expect(result.bestQuote).toBeDefined();
      expect([DexProvider.RAYDIUM, DexProvider.METEORA]).toContain(result.bestQuote.provider);

      // Best quote should have the highest amountOut
      const otherQuote = result.allQuotes.find(q => q.provider !== result.bestQuote.provider);
      expect(result.bestQuote.amountOut).toBeGreaterThanOrEqual(otherQuote!.amountOut);
    });

    it('should return quotes from both Raydium and Meteora', async () => {
      const result = await dexRouter.getBestQuote('SOL', 'USDC', 100);

      const providers = result.allQuotes.map(q => q.provider);
      expect(providers).toContain(DexProvider.RAYDIUM);
      expect(providers).toContain(DexProvider.METEORA);
    });
  });

  describe('executeSwap', () => {
    it('should successfully execute a swap', async () => {
      const order = {
        id: 'test-order-1',
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        status: 'pending' as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);
      const result = await dexRouter.executeSwap(order, quote);

      if (result.success) {
        expect(result).toMatchObject({
          success: true,
          txHash: expect.any(String),
          executedPrice: expect.any(Number),
          amountOut: expect.any(Number),
          gasUsed: expect.any(Number)
        });

        expect(result.txHash).toHaveLength(64);
        expect(result.executedPrice).toBeGreaterThan(0);
        expect(result.amountOut).toBeGreaterThan(0);
      } else {
        expect(result).toMatchObject({
          success: false,
          error: expect.any(String)
        });
      }
    });

    it('should apply slippage protection', async () => {
      const order = {
        id: 'test-order-2',
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 0.01,
        status: 'pending' as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);
      const result = await dexRouter.executeSwap(order, quote);

      if (result.success) {
        // Final amount should be less than or equal to quote due to slippage
        expect(result.amountOut).toBeLessThanOrEqual(quote.amountOut);
        
        // But should be within slippage tolerance
        const maxSlippage = quote.amountOut * order.slippage;
        expect(result.amountOut).toBeGreaterThan(quote.amountOut - maxSlippage);
      }
    });
  });
});
