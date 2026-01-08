import { prisma } from "./prisma";
import { createEscrowWallet } from "./privy";

const UNLOCK_SECONDS = Number(process.env.STAKE_UNLOCK_SECONDS || 3600); // 1 hour default
const COOLDOWN_SECONDS = 48 * 60 * 60; // 48 hours

/**
 * Calculate time-based multiplier for staking duration
 * Longer stake = higher multiplier for allocations
 * 
 * Base: 1.0x
 * 3 days: 1.25x
 * 7 days: 1.5x
 * 10 days: 1.75x
 * 14 days: 2.0x (max)
 */
export function calculateMultiplier(stakedAt) {
  if (!stakedAt) return 1.0;
  
  const now = Date.now();
  const stakedTime = new Date(stakedAt).getTime();
  const daysStaked = (now - stakedTime) / (1000 * 60 * 60 * 24);
  
  if (daysStaked >= 14) return 2.0;
  if (daysStaked >= 10) return 1.75;
  if (daysStaked >= 7) return 1.5;
  if (daysStaked >= 3) return 1.25;
  return 1.0;
}

/**
 * Get or create a stake account for a user wallet
 * Creates a Privy escrow wallet on first stake
 */
export async function getOrCreateStakeAccount(userWallet) {
  let account = await prisma.stakeAccount.findUnique({
    where: { userWallet },
  });
  
  if (!account) {
    account = await prisma.stakeAccount.create({
      data: { userWallet },
    });
  }
  
  return account;
}

/**
 * Initialize Privy escrow wallet for a stake account
 * Called when user first opts into staking
 */
export async function initializeEscrowWallet(userWallet) {
  const account = await getOrCreateStakeAccount(userWallet);
  
  if (account.privyWalletId) {
    return account; // Already has escrow wallet
  }
  
  // Create new Privy wallet
  const escrowWallet = await createEscrowWallet(userWallet);
  
  // Update account with Privy wallet info
  const updated = await prisma.stakeAccount.update({
    where: { id: account.id },
    data: {
      privyWalletId: escrowWallet.id,
      privyWalletAddr: escrowWallet.address,
    },
  });
  
  return updated;
}

/**
 * Get stake summary for a user
 */
export async function getStakeSummary(userWallet) {
  const account = await prisma.stakeAccount.findUnique({
    where: { userWallet },
    include: {
      allocations: {
        where: { claimed: false },
        include: { launch: true },
      },
    },
  });
  
  if (!account) {
    return null;
  }
  
  const multiplier = calculateMultiplier(account.stakedAt);
  const weightedStake = Number(account.stakedAmount) * multiplier;
  
  return {
    userWallet: account.userWallet,
    escrowWallet: account.privyWalletAddr,
    stakedAmount: Number(account.stakedAmount),
    pendingUnstakeAmount: Number(account.pendingUnstakeAmount),
    stakedAt: account.stakedAt,
    unlockAt: account.unlockAt,
    cooldownUntil: account.cooldownUntil,
    multiplier,
    weightedStake,
    unclaimedAllocations: account.allocations.map((a) => ({
      allocationId: a.id,
      launchId: a.launchId,
      launchName: a.launch.name,
      ticker: a.launch.ticker,
      tokenAmount: Number(a.tokenAmount),
      sharePercent: Number(a.sharePercent),
    })),
  };
}

/**
 * Record a stake deposit
 * User sends $DEVITO to their Privy escrow wallet, we record it here
 */
export async function recordStake(userWallet, amount, txSignature) {
  const account = await getOrCreateStakeAccount(userWallet);
  
  // Check cooldown
  if (account.cooldownUntil && new Date(account.cooldownUntil) > new Date()) {
    throw new Error("COOLDOWN_ACTIVE");
  }
  
  // Ensure escrow wallet exists
  if (!account.privyWalletId) {
    throw new Error("ESCROW_NOT_INITIALIZED");
  }
  
  const isFirstStake = Number(account.stakedAmount) === 0;
  
  // Update stake amount
  const updated = await prisma.stakeAccount.update({
    where: { id: account.id },
    data: {
      stakedAmount: { increment: amount },
      stakedAt: isFirstStake ? new Date() : account.stakedAt,
    },
  });
  
  // Log event
  await prisma.stakeEvent.create({
    data: {
      accountId: account.id,
      action: "stake",
      amount,
      txSignature,
    },
  });
  
  return updated;
}

/**
 * Request unstake - starts the unlock timer
 */
export async function requestUnstake(userWallet, amount) {
  const account = await prisma.stakeAccount.findUnique({
    where: { userWallet },
  });
  
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }
  
  if (account.unlockAt) {
    throw new Error("ALREADY_PENDING_UNLOCK");
  }
  
  if (Number(account.stakedAmount) < amount) {
    throw new Error("INSUFFICIENT_STAKED");
  }
  
  const unlockAt = new Date(Date.now() + UNLOCK_SECONDS * 1000);
  
  const updated = await prisma.stakeAccount.update({
    where: { id: account.id },
    data: {
      stakedAmount: { decrement: amount },
      pendingUnstakeAmount: { increment: amount },
      unlockAt,
    },
  });
  
  await prisma.stakeEvent.create({
    data: {
      accountId: account.id,
      action: "request_unstake",
      amount,
    },
  });
  
  return updated;
}

/**
 * Claim unstaked tokens after unlock period
 * Returns tokens from escrow to user wallet
 */
export async function claimUnstaked(userWallet) {
  const account = await prisma.stakeAccount.findUnique({
    where: { userWallet },
  });
  
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }
  
  if (!account.unlockAt) {
    throw new Error("NO_PENDING_UNLOCK");
  }
  
  if (new Date(account.unlockAt) > new Date()) {
    throw new Error("NOT_UNLOCKED_YET");
  }
  
  const claimAmount = Number(account.pendingUnstakeAmount);
  const cooldownUntil = new Date(Date.now() + COOLDOWN_SECONDS * 1000);
  
  // Reset staking timer if fully unstaked
  const remainingStake = Number(account.stakedAmount);
  
  const updated = await prisma.stakeAccount.update({
    where: { id: account.id },
    data: {
      pendingUnstakeAmount: 0,
      unlockAt: null,
      cooldownUntil,
      stakedAt: remainingStake > 0 ? account.stakedAt : null,
    },
  });
  
  await prisma.stakeEvent.create({
    data: {
      accountId: account.id,
      action: "claim",
      amount: claimAmount,
    },
  });
  
  return {
    account: updated,
    claimAmount,
    cooldownUntil,
  };
}

/**
 * Get all active stakers for distribution calculation
 */
export async function getAllActiveStakers() {
  const accounts = await prisma.stakeAccount.findMany({
    where: {
      stakedAmount: { gt: 0 },
    },
  });
  
  return accounts.map((a) => {
    const multiplier = calculateMultiplier(a.stakedAt);
    return {
      id: a.id,
      userWallet: a.userWallet,
      escrowWallet: a.privyWalletAddr,
      stakedAmount: Number(a.stakedAmount),
      stakedAt: a.stakedAt,
      multiplier,
      weightedStake: Number(a.stakedAmount) * multiplier,
    };
  });
}

/**
 * Calculate and create allocations for a new launch
 */
export async function createLaunchAllocations(launchId, totalTokensForStakers) {
  const stakers = await getAllActiveStakers();
  
  if (stakers.length === 0) {
    return [];
  }
  
  // Calculate total weighted stake
  const totalWeightedStake = stakers.reduce((sum, s) => sum + s.weightedStake, 0);
  
  // Create allocations
  const allocations = [];
  
  for (const staker of stakers) {
    const sharePercent = staker.weightedStake / totalWeightedStake;
    const tokenAmount = totalTokensForStakers * sharePercent;
    
    const allocation = await prisma.allocation.create({
      data: {
        accountId: staker.id,
        launchId,
        stakedAtSnapshot: staker.stakedAmount,
        multiplier: staker.multiplier,
        weightedStake: staker.weightedStake,
        sharePercent,
        tokenAmount,
      },
    });
    
    allocations.push(allocation);
  }
  
  return allocations;
}

/**
 * Claim launch allocation tokens
 */
export async function claimAllocation(userWallet, allocationId) {
  const account = await prisma.stakeAccount.findUnique({
    where: { userWallet },
  });
  
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }
  
  const allocation = await prisma.allocation.findFirst({
    where: {
      id: allocationId,
      accountId: account.id,
      claimed: false,
    },
    include: { launch: true },
  });
  
  if (!allocation) {
    throw new Error("ALLOCATION_NOT_FOUND");
  }
  
  // TODO: Execute actual token transfer from launch wallet to user
  // This would use Privy to sign the transaction
  
  const updated = await prisma.allocation.update({
    where: { id: allocationId },
    data: {
      claimed: true,
      claimedAt: new Date(),
    },
  });
  
  return updated;
}
