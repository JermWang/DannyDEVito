CREATE TABLE "LaunchSchedule" (
    "id" TEXT NOT NULL,
    "nextLaunchAt" TIMESTAMP(3) NOT NULL,
    "cadenceHours" INTEGER NOT NULL DEFAULT 72,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledLaunchDraft" (
    "id" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "description" TEXT,
    "metadataImageUrl" TEXT,
    "metadataUri" TEXT,
    "spendableSolLamports" TEXT,
    "generatedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "launchingAt" TIMESTAMP(3),
    "launchingId" TEXT,
    "launchedAt" TIMESTAMP(3),
    "launchTxSignature" TEXT,
    "mint" TEXT,
    "pumpUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledLaunchDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledLaunchDraft_scheduledAt_key" ON "ScheduledLaunchDraft"("scheduledAt");

CREATE INDEX "ScheduledLaunchDraft_scheduledAt_idx" ON "ScheduledLaunchDraft"("scheduledAt");
