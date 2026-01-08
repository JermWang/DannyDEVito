-- CreateTable
CREATE TABLE "StakeAccount" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "privyWalletId" TEXT,
    "privyWalletAddr" TEXT,
    "stakedAmount" DECIMAL(20,9) NOT NULL DEFAULT 0,
    "pendingUnstakeAmount" DECIMAL(20,9) NOT NULL DEFAULT 0,
    "stakedAt" TIMESTAMP(3),
    "unlockAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakeEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(20,9) NOT NULL,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "mint" TEXT,
    "pumpUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalSupply" DECIMAL(20,9),
    "stakerShare" DECIMAL(5,4),
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "stakedAtSnapshot" DECIMAL(20,9) NOT NULL,
    "multiplier" DECIMAL(5,2) NOT NULL,
    "weightedStake" DECIMAL(20,9) NOT NULL,
    "sharePercent" DECIMAL(10,8) NOT NULL,
    "tokenAmount" DECIMAL(20,9) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "claimTxSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "wallet" TEXT,
    "nickname" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DannyChat" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "wallet" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DannyChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StakeAccount_userWallet_key" ON "StakeAccount"("userWallet");

-- CreateIndex
CREATE UNIQUE INDEX "StakeAccount_privyWalletId_key" ON "StakeAccount"("privyWalletId");

-- CreateIndex
CREATE INDEX "StakeEvent_accountId_idx" ON "StakeEvent"("accountId");

-- CreateIndex
CREATE INDEX "Allocation_launchId_idx" ON "Allocation"("launchId");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_accountId_launchId_key" ON "Allocation"("accountId", "launchId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_wallet_idx" ON "ChatMessage"("wallet");

-- CreateIndex
CREATE INDEX "DannyChat_sessionId_idx" ON "DannyChat"("sessionId");

-- CreateIndex
CREATE INDEX "DannyChat_wallet_idx" ON "DannyChat"("wallet");

-- AddForeignKey
ALTER TABLE "StakeEvent" ADD CONSTRAINT "StakeEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StakeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StakeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
