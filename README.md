# Eterna Order Execution Engine

A robust order execution engine with DEX routing and WebSocket status updates for trading on Solana DEXs.

## 🎯 Design Decisions

## 🎯 Order Type Choice: Market Orders

**Why Market Orders?** Market orders were chosen as the primary implementation because they provide the most comprehensive demonstration of the entire execution pipeline with immediate execution, real-time DEX routing decisions, and clear status progression through all system components.

**Extension Strategy:** The architecture easily extends to other order types:

- **Limit Orders**: Already implemented - waits for target price to be reached before executing as market order
- **Sniper Orders**: Already implemented - waits for launch time before executing as market order

## 🏗️ Architecture

### Core Components

- **FastifyJS** - High-performance HTTP server with WebSocket support
- **BullMQ + Redis** - Robust queue system for concurrent order processing
- **PostgreSQL** - Persistent order storage and history
- **Mock DEX Router** - Simulates Raydium and Meteora price comparison

### Order Processing Flow

1. **Submission** → Order submitted via POST `/api/orders/submit`
2. **Queuing** → Added to Redis queue with priority (Sniper > Limit > Market)
3. **Routing** → System compares prices from Raydium and Meteora
4. **Execution** → Routes to DEX with better price/liquidity
5. **Updates** → Real-time status via WebSocket at `/ws/orders/:orderId`

### Status Flow

- `pending` → Order received and queued
- `routing` → Comparing DEX prices
- `building` → Creating transaction
- `submitted` → Transaction sent to network
- `confirmed` → Transaction successful (includes txHash)
- `failed` → Error occurred (includes error message)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 6+
- macOS with Homebrew (or manually install PostgreSQL/Redis)

### Local Setup (Recommended)

1. **Clone and install dependencies**

```bash
git clone https://github.com/ShubhamDani-dev/Order-Execution-Engine.git
cd Order-Execution-Engine
npm install
```

2. **Install PostgreSQL and Redis via Homebrew**

```bash
# Install services
brew install postgresql@15 redis

# Start services
brew services start postgresql@15
brew services start redis

# Add PostgreSQL to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

3. **Create database**

```bash
createdb eterna_orders
```

4. **Configure environment**

```bash
# Copy environment template
cp .env.example .env

# Update .env with your settings (default local setup works)
# DATABASE_URL=postgresql://$(whoami)@localhost:5432/eterna_orders
```

5. **Start the application**

```bash
# Development mode (with auto-restart)
npm run dev

# Or build and start
npm run build
npm start
```

### Testing Without Database

You can run the core tests without database dependencies:

```bash
npm test -- tests/dexRouter.test.ts tests/orderService.test.ts
```

## 📡 API Endpoints

### Submit Order

```bash
POST /api/orders/submit
Content-Type: application/json

{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100,
  "slippage": 0.01,
  "userId": "user123"
}
```

### WebSocket Connection

```javascript
const ws = new WebSocket("ws://localhost:3000/ws/orders/ORDER_ID");
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`Order ${update.orderId} status: ${update.status}`);
};
```

### Other Endpoints

- `GET /api/orders/:orderId` - Get order details
- `GET /api/orders` - Get recent orders
- `GET /api/queue/stats` - Queue statistics
- `GET /health` - System health check

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- --testNamePattern="DEX Router"
```

### Test Coverage

All 28 tests passing (100% success rate):

- ✅ DEX routing logic with price comparison
- ✅ Order service lifecycle management  
- ✅ Queue behavior with concurrent processing
- ✅ API endpoint validation and responses
- ✅ WebSocket connection lifecycle
- ✅ Error handling and retry mechanisms

## 🔧 Configuration

Key environment variables:

- `MAX_CONCURRENT_ORDERS=10` - Queue concurrency limit
- `ORDERS_PER_MINUTE=100` - Rate limiting
- `SLIPPAGE_TOLERANCE=0.01` - Default slippage protection
- `MAX_RETRY_ATTEMPTS=3` - Failed order retry limit

## 📊 Performance Features

- **Concurrent Processing**: Up to 10 orders simultaneously
- **Rate Limiting**: 100 orders per minute
- **Retry Logic**: Exponential backoff for failed orders
- **Connection Pooling**: Efficient database connections
- **WebSocket Broadcasting**: Real-time updates to all connected clients

## 🔗 DEX Router Logic

The mock implementation simulates realistic DEX behavior:

- **Raydium**: 0.3% fee, slightly higher price variance
- **Meteora**: 0.2% fee, better for larger trades
- **Price Impact**: Scales with trade size
- **Slippage Protection**: Respects user-defined tolerance
- **Execution Time**: 2-3 second realistic delays

## 📝 Order Types Explanation

### Market Orders (Implemented)

- Execute immediately at current market price
- Best for urgent trades where price certainty is less important
- Guaranteed execution (unless system failure)

### Limit Orders (Implemented)

- Execute only when target price is reached
- Better price control but no execution guarantee
- Useful for patient traders wanting specific entry/exit points

### Sniper Orders (Implemented)

- Execute immediately when token launches/migrates
- High priority processing for time-sensitive opportunities
- Critical for trading new token listings

## 🚨 Error Handling

- **Network Issues**: Exponential backoff retry (3 attempts max)
- **Database Errors**: Transaction rollback and graceful degradation
- **Queue Failures**: Dead letter queue for manual review
- **WebSocket Errors**: Automatic reconnection with status preservation

## 📈 Monitoring

Access real-time metrics:

- Queue depth and processing rate
- Order success/failure rates
- DEX routing decisions
- WebSocket connection counts

## 🔜 Future Enhancements

- Real Solana devnet integration
- Advanced order types (Stop-loss, Take-profit)
- Multi-hop routing through multiple DEXs
- MEV protection mechanisms
- Advanced analytics dashboard

---

**Built with ❤️ for the Solana ecosystem**
