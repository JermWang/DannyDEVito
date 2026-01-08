# Danny DEVito Staking System Setup

## Overview

The staking system allows users to stake $DEVITO tokens to earn weighted allocations of new coin launches. It uses:

- **Privy Server Wallets** for off-chain escrow (no smart contracts)
- **PostgreSQL/Supabase** for persistence
- **Time-based multipliers** rewarding longer stakers

## Architecture

```
User Wallet ──► Privy Escrow Wallet ──► Distribution to User
     │                  │
     │                  ▼
     │         [Off-chain Database]
     │         - StakeAccount
     │         - StakeEvent
     │         - Allocation
     │
     ▼
  Staking UI
```

## Setup Steps

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Database (Supabase Postgres with transaction pooler)
DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"

# Privy Server Wallet API (get from privy.io dashboard)
PRIVY_APP_ID="your-privy-app-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# Staking config
STAKE_UNLOCK_SECONDS=3600  # 1 hour unlock period
```

### 2. Database Migration

Run Prisma migration to create tables:

```bash
npx prisma migrate dev --name init
```

Or for production:

```bash
npx prisma migrate deploy
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

## User Flow

### Staking Flow

1. **Connect Wallet** - User enters their Solana wallet address
2. **Create Escrow** - System creates a Privy server wallet linked 1:1 to user
3. **Deposit** - User sends $DEVITO to their escrow wallet address
4. **Confirm Deposit** - User clicks "Confirm Deposit" with amount sent
5. **Earn Multipliers** - Longer stake = higher multiplier (up to 2.5x at 180 days)

### Unstaking Flow

1. **Request Unstake** - Starts unlock timer (default 1 hour)
2. **Wait for Unlock** - Timer counts down
3. **Claim Tokens** - After unlock, claim returns tokens to user
4. **48h Cooldown** - Must wait before staking again

### Allocation Flow

1. **Launch Created** - Admin creates new coin launch in vault
2. **Snapshot Taken** - System snapshots all staker balances + multipliers
3. **Allocations Calculated** - Weighted distribution based on stake × multiplier
4. **Claim Allocations** - Users claim their launch tokens

## Time Multipliers

| Duration | Multiplier |
|----------|------------|
| Day 1    | 1.00x      |
| 7 Days   | 1.25x      |
| 30 Days  | 1.50x      |
| 90 Days  | 2.00x      |
| 180 Days | 2.50x      |

## API Endpoints

### GET /api/staking?wallet=<address>

Get staking summary for a wallet.

**Response:**
```json
{
  "ok": true,
  "summary": {
    "userWallet": "...",
    "escrowWallet": "...",
    "stakedAmount": 1000,
    "pendingUnstakeAmount": 0,
    "stakedAt": "2024-01-01T00:00:00Z",
    "unlockAt": null,
    "cooldownUntil": null,
    "multiplier": 1.5,
    "weightedStake": 1500,
    "unclaimedAllocations": []
  }
}
```

### POST /api/staking

Actions:

- `init_escrow` - Create Privy escrow wallet
- `stake` - Record deposit (amount, txSignature)
- `request_unstake` - Start unlock timer (amount)
- `claim` - Claim unlocked tokens
- `claim_allocation` - Claim launch allocation (allocationId)

## Database Schema

### StakeAccount
- Links user wallet to Privy escrow wallet
- Tracks staked amount, pending unstake, timestamps

### StakeEvent
- Audit log of all stake/unstake/claim events

### Launch
- Coin launches from the vault
- Total supply, staker share percentage

### Allocation
- Per-user allocation for each launch
- Snapshot of stake, multiplier, share percent

## Security Notes

- All tokens held in Privy custody (server-side wallets)
- No smart contracts = no on-chain exploits
- 48h cooldown prevents rapid stake cycling
- Unlock period prevents flash unstaking

## TODO

- [ ] Integrate actual Solana token transfers
- [ ] Add transaction signature verification
- [ ] Build admin panel for launch distribution
- [ ] Add webhook for deposit detection
