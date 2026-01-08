-- CreateTable
CREATE TABLE "AdminNonce" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNonce_wallet_nonce_key" ON "AdminNonce"("wallet", "nonce");

-- CreateIndex
CREATE INDEX "AdminNonce_createdAt_idx" ON "AdminNonce"("createdAt");
