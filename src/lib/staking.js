import crypto from "crypto";

import { prisma } from "./prisma";
import { createEscrowWallet } from "./privy";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  getConnection,
  getSolanaCaip2,
  privyGetWallet,
  privySignAndSendSolanaTransaction,
  privySignSolanaTransaction,
} from "./privyServer";

const UNLOCK_SECONDS = Number(process.env.STAKE_UNLOCK_SECONDS || 3600); // 1 hour default
const COOLDOWN_SECONDS = 48 * 60 * 60; // 48 hours

const DEVITO_TOKEN_MINT = String(process.env.DEVITO_TOKEN_MINT ?? "").trim();
const TREASURY_WALLET_ID = String(process.env.TREASURY_WALLET_ID ?? "").trim();
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const PLATFORM_GRAB_PERCENT = 0.05;
const STAKER_SHARE_OF_PLATFORM_GRAB_PERCENT = 0.02;

function parseUiAmountToRawBigInt(amountUi, decimals) {
  const d = Math.max(0, Math.floor(Number(decimals ?? 0)));
  const rawStr = String(amountUi ?? "").trim();
  if (!rawStr) return null;

  const neg = rawStr.startsWith("-");
  const cleaned = neg ? rawStr.slice(1) : rawStr;
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;

  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(d)).slice(0, d);
  const combined = (whole || "0") + fracPadded;
  const normalized = combined.replace(/^0+/, "") || "0";
  const bi = BigInt(normalized);
  return neg ? -bi : bi;
}

export function calculateStakerTokensFromTotalSupply(totalSupply) {
  const supply = Number(totalSupply);
  if (!Number.isFinite(supply) || supply <= 0) {
    throw new Error("TOTAL_SUPPLY_INVALID");
  }
  return supply * PLATFORM_GRAB_PERCENT * STAKER_SHARE_OF_PLATFORM_GRAB_PERCENT;
}

async function getDevitoMintInfo() {
  if (!DEVITO_TOKEN_MINT) {
    throw new Error("DEVITO_MINT_NOT_CONFIGURED");
  }

  const connection = getConnection();
  const mintPubkey = new PublicKey(DEVITO_TOKEN_MINT);
  const info = await connection.getAccountInfo(mintPubkey);
  if (!info) {
    throw new Error("DEVITO_MINT_NOT_FOUND");
  }

  const owner = info.owner.toBase58();
  const tokenProgramId = owner === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const mint = await getMint(connection, mintPubkey, "confirmed", tokenProgramId);

  return {
    connection,
    mintPubkey,
    tokenProgramId,
    decimals: mint.decimals,
  };
}

function randomClaimId() {
  return `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
}

function memoIx(memo) {
  const data = Buffer.from(String(memo ?? ""), "utf8");
  return new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data });
}

async function mustGetParsedConfirmedTx(signature) {
  const sig = String(signature ?? "").trim();
  if (!sig) {
    throw new Error("TX_SIGNATURE_REQUIRED");
  }

  const connection = getConnection();
  const tx = await connection.getParsedTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error("TX_NOT_FOUND");
  }

  if (tx?.meta?.err) {
    throw new Error("TX_FAILED");
  }

  return tx;
}

async function mustGetTreasuryWallet() {
  if (!TREASURY_WALLET_ID) {
    throw new Error("TREASURY_WALLET_NOT_CONFIGURED");
  }
  const w = await privyGetWallet(TREASURY_WALLET_ID);
  const addr = String(w?.address ?? "").trim();
  if (!addr) {
    throw new Error("TREASURY_WALLET_NOT_CONFIGURED");
  }
  return { walletId: TREASURY_WALLET_ID, pubkey: new PublicKey(addr) };
}

async function getMintInfoForMint(mintBase58) {
  const mintStr = String(mintBase58 ?? "").trim();
  if (!mintStr) {
    throw new Error("MINT_REQUIRED");
  }

  const connection = getConnection();
  const mintPubkey = new PublicKey(mintStr);
  const info = await connection.getAccountInfo(mintPubkey);
  if (!info) {
    throw new Error("MINT_NOT_FOUND");
  }

  const owner = info.owner.toBase58();
  const tokenProgramId = owner === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const mint = await getMint(connection, mintPubkey, "confirmed", tokenProgramId);

  return {
    connection,
    mintPubkey,
    tokenProgramId,
    decimals: mint.decimals,
  };
}

function getAccountKeyBase58(key) {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key?.pubkey?.toBase58 === "function") return key.pubkey.toBase58();
  if (typeof key?.toBase58 === "function") return key.toBase58();
  return String(key?.pubkey ?? key ?? "");
}

function getTokenBalanceDeltaForAccount({ tx, mintBase58, accountBase58 }) {
  const pre = Array.isArray(tx?.meta?.preTokenBalances) ? tx.meta.preTokenBalances : [];
  const post = Array.isArray(tx?.meta?.postTokenBalances) ? tx.meta.postTokenBalances : [];
  const accountKeys = tx?.transaction?.message?.accountKeys || [];

  const indices = [];
  for (let i = 0; i < accountKeys.length; i++) {
    if (getAccountKeyBase58(accountKeys[i]) === accountBase58) indices.push(i);
  }
  if (indices.length === 0) return 0n;

  const preByIndex = new Map(pre.map((b) => [b.accountIndex, b]));
  const postByIndex = new Map(post.map((b) => [b.accountIndex, b]));

  let delta = 0n;
  for (const idx of indices) {
    const preBal = preByIndex.get(idx);
    const postBal = postByIndex.get(idx);
    if (preBal && String(preBal?.mint ?? "") !== mintBase58) continue;
    if (postBal && String(postBal?.mint ?? "") !== mintBase58) continue;

    const preAmt = BigInt(String(preBal?.uiTokenAmount?.amount ?? "0"));
    const postAmt = BigInt(String(postBal?.uiTokenAmount?.amount ?? "0"));
    delta += postAmt - preAmt;
  }

  return delta;
}

async function verifyStakeDepositTx({ userWallet, escrowWallet, amountUi, txSignature }) {
  const { connection, mintPubkey, tokenProgramId, decimals } = await getDevitoMintInfo();

  const sig = String(txSignature ?? "").trim();
  if (!sig) {
    throw new Error("TX_SIGNATURE_REQUIRED");
  }

  const tx = await connection.getParsedTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error("TX_NOT_FOUND");
  }

  if (tx?.meta?.err) {
    throw new Error("TX_FAILED");
  }

  const userPk = new PublicKey(userWallet);
  const escrowPk = new PublicKey(escrowWallet);
  const mintBase58 = mintPubkey.toBase58();

  const accountKeys = tx?.transaction?.message?.accountKeys || [];
  const userSigner = accountKeys.some((k) => {
    const pubkey = typeof k?.pubkey?.toBase58 === "function" ? k.pubkey.toBase58() : String(k?.pubkey ?? "");
    return pubkey === userPk.toBase58() && Boolean(k?.signer);
  });
  if (!userSigner) {
    throw new Error("TX_NOT_SIGNED_BY_WALLET");
  }

  const expectedRaw = parseUiAmountToRawBigInt(amountUi, decimals);
  if (expectedRaw == null || expectedRaw <= 0n) {
    throw new Error("AMOUNT_INVALID");
  }

  const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPk, false, tokenProgramId);
  const escrowAtaBase58 = escrowAta.toBase58();

  const escrowDelta = getTokenBalanceDeltaForAccount({
    tx,
    mintBase58,
    accountBase58: escrowAtaBase58,
  });

  if (escrowDelta !== expectedRaw) {
    throw new Error("DEPOSIT_AMOUNT_MISMATCH");
  }

  const instructions = Array.isArray(tx?.transaction?.message?.instructions)
    ? tx.transaction.message.instructions
    : [];

  const hasMatchingTransfer = instructions.some((ix) => {
    const programId = String(ix?.programId?.toBase58?.() ?? ix?.programId ?? "");
    const isTokenProgram = programId === tokenProgramId.toBase58() || ix?.program === "spl-token";
    if (!isTokenProgram) return false;

    const type = String(ix?.parsed?.type ?? "");
    const info = ix?.parsed?.info;
    if (!info) return false;

    if (type !== "transfer" && type !== "transferChecked") return false;

    const destination = String(info?.destination ?? "");
    if (destination !== escrowAtaBase58) return false;

    const authority = String(info?.authority ?? "");
    if (authority !== userPk.toBase58()) return false;

    const mint = String(info?.mint ?? "");
    if (mint && mint !== mintBase58) return false;

    const amountStr =
      String(info?.tokenAmount?.amount ?? "").trim() ||
      String(info?.amount ?? "").trim();

    if (!amountStr) return false;

    try {
      return BigInt(amountStr) === expectedRaw;
    } catch {
      return false;
    }
  });

  if (!hasMatchingTransfer) {
    throw new Error("DEPOSIT_SOURCE_MISMATCH");
  }

  return {
    connection,
    mintPubkey,
    tokenProgramId,
    decimals,
    amountRaw: expectedRaw,
  };
}

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

  const txSig = String(txSignature ?? "").trim();
  if (!txSig) {
    throw new Error("TX_SIGNATURE_REQUIRED");
  }

  const existing = await prisma.stakeEvent.findFirst({
    where: {
      txSignature: txSig,
      action: "stake",
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("TX_ALREADY_USED");
  }

  await verifyStakeDepositTx({
    userWallet,
    escrowWallet: account.privyWalletAddr,
    amountUi: amount,
    txSignature: txSig,
  });
  
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
      txSignature: txSig,
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

  if (!account.privyWalletId || !account.privyWalletAddr) {
    throw new Error("ESCROW_NOT_INITIALIZED");
  }

  const { connection, mintPubkey, tokenProgramId, decimals } = await getDevitoMintInfo();
  const escrowPubkey = new PublicKey(account.privyWalletAddr);
  const userPubkey = new PublicKey(userWallet);
  const claimRaw = parseUiAmountToRawBigInt(claimAmount, decimals);
  if (claimRaw == null || claimRaw <= 0n) {
    throw new Error("AMOUNT_INVALID");
  }

  const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPubkey, false, tokenProgramId);
  const userAta = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, tokenProgramId);

  const tx = new Transaction();
  tx.feePayer = escrowPubkey;

  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        escrowPubkey,
        userAta,
        userPubkey,
        mintPubkey,
        tokenProgramId
      )
    );
  }

  tx.add(createTransferInstruction(escrowAta, userAta, escrowPubkey, claimRaw, [], tokenProgramId));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  const txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");

  const sent = await privySignAndSendSolanaTransaction({
    walletId: account.privyWalletId,
    caip2: getSolanaCaip2(),
    transactionBase64: txBase64,
  });
  
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
      txSignature: sent.signature,
    },
  });
  
  return {
    account: updated,
    claimAmount,
    cooldownUntil,
    signature: sent.signature,
  };
}

export async function prepareClaimUnstakeAndAllocations(userWallet) {
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
  if (!account.privyWalletId || !account.privyWalletAddr) {
    throw new Error("ESCROW_NOT_INITIALIZED");
  }

  const claimId = randomClaimId();
  const userPubkey = new PublicKey(userWallet);

  const { connection, mintPubkey, tokenProgramId, decimals } = await getDevitoMintInfo();
  const escrowPubkey = new PublicKey(account.privyWalletAddr);
  const claimRaw = parseUiAmountToRawBigInt(claimAmount, decimals);
  if (claimRaw == null || claimRaw <= 0n) {
    throw new Error("AMOUNT_INVALID");
  }

  const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPubkey, false, tokenProgramId);
  const userAta = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, tokenProgramId);

  const unstakeTx = new Transaction();
  unstakeTx.feePayer = userPubkey;

  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    unstakeTx.add(
      createAssociatedTokenAccountInstruction(userPubkey, userAta, userPubkey, mintPubkey, tokenProgramId)
    );
  }

  unstakeTx.add(memoIx(`dd:unstake:${claimId}`));
  unstakeTx.add(createTransferInstruction(escrowAta, userAta, escrowPubkey, claimRaw, [], tokenProgramId));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  unstakeTx.recentBlockhash = blockhash;
  unstakeTx.lastValidBlockHeight = lastValidBlockHeight;

  const unstakeBytes = unstakeTx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const unstakeBase64 = Buffer.from(Uint8Array.from(unstakeBytes)).toString("base64");
  const unstakeSigned = await privySignSolanaTransaction({
    walletId: account.privyWalletId,
    transactionBase64: unstakeBase64,
  });

  const allocations = await prisma.allocation.findMany({
    where: {
      accountId: account.id,
      claimed: false,
    },
    include: {
      launch: { select: { id: true, mint: true, name: true, ticker: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const allocationTxs = [];
  const includedAllocationIds = new Set();

  if (allocations.length > 0) {
    let treasury = null;

    const chunkSize = 3;
    for (let i = 0; i < allocations.length; i += chunkSize) {
      const chunk = allocations.slice(i, i + chunkSize);
      const tx = new Transaction();
      tx.feePayer = userPubkey;

      tx.add(memoIx(`dd:alloc:${claimId}:${chunk.map((a) => a.id).join(",")}`));

      let hasTransfer = false;

      for (const allocation of chunk) {
        const mintStr = String(allocation?.launch?.mint ?? "").trim();
        if (!mintStr) {
          throw new Error("LAUNCH_MINT_MISSING");
        }

        const { mintPubkey: allocMintPubkey, tokenProgramId: allocTokenProgramId, decimals: allocDecimals } =
          await getMintInfoForMint(mintStr);

        const amountUi = Number(allocation.tokenAmount);
        const raw = parseUiAmountToRawBigInt(amountUi, allocDecimals);
        if (raw == null || raw <= 0n) {
          continue;
        }

        hasTransfer = true;
        includedAllocationIds.add(allocation.id);

        if (!treasury) {
          treasury = await mustGetTreasuryWallet();
        }

        const treasuryAta = await getAssociatedTokenAddress(
          allocMintPubkey,
          treasury.pubkey,
          false,
          allocTokenProgramId
        );
        const userAllocAta = await getAssociatedTokenAddress(allocMintPubkey, userPubkey, false, allocTokenProgramId);

        const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
        if (!treasuryAtaInfo) {
          throw new Error("TREASURY_ATA_NOT_FOUND");
        }

        const userAllocAtaInfo = await connection.getAccountInfo(userAllocAta);
        if (!userAllocAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              userPubkey,
              userAllocAta,
              userPubkey,
              allocMintPubkey,
              allocTokenProgramId
            )
          );
        }

        tx.add(createTransferInstruction(treasuryAta, userAllocAta, treasury.pubkey, raw, [], allocTokenProgramId));
      }

      if (!hasTransfer) {
        continue;
      }

      const bh = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;
      tx.lastValidBlockHeight = bh.lastValidBlockHeight;

      const txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");
      const signed = await privySignSolanaTransaction({ walletId: treasury.walletId, transactionBase64: txBase64 });
      allocationTxs.push(signed.signedTransactionBase64);
    }
  }

  return {
    claimId,
    claimAmount,
    allocationIds: [...includedAllocationIds],
    unstakeTxBase64: unstakeSigned.signedTransactionBase64,
    allocationTxsBase64: allocationTxs,
  };
}

export async function finalizeClaimUnstakeAndAllocations({
  userWallet,
  claimAmount,
  allocationIds,
  unstakeTxSignature,
  allocationTxSignatures,
}) {
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

  const expectedClaimAmount = Number(account.pendingUnstakeAmount);
  const claimAmt = Number(claimAmount);
  if (!Number.isFinite(claimAmt) || claimAmt <= 0 || Math.abs(claimAmt - expectedClaimAmount) > 1e-9) {
    throw new Error("AMOUNT_INVALID");
  }

  if (!account.privyWalletAddr) {
    throw new Error("ESCROW_NOT_INITIALIZED");
  }

  const { mintPubkey, tokenProgramId, decimals } = await getDevitoMintInfo();
  const userPubkey = new PublicKey(userWallet);
  const escrowPubkey = new PublicKey(account.privyWalletAddr);
  const claimRaw = parseUiAmountToRawBigInt(claimAmt, decimals);
  if (claimRaw == null || claimRaw <= 0n) {
    throw new Error("AMOUNT_INVALID");
  }

  const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPubkey, false, tokenProgramId);
  const userAta = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, tokenProgramId);

  const unstakeTx = await mustGetParsedConfirmedTx(unstakeTxSignature);
  const unstakeUserDelta = getTokenBalanceDeltaForAccount({
    tx: unstakeTx,
    mintBase58: mintPubkey.toBase58(),
    accountBase58: userAta.toBase58(),
  });
  const unstakeEscrowDelta = getTokenBalanceDeltaForAccount({
    tx: unstakeTx,
    mintBase58: mintPubkey.toBase58(),
    accountBase58: escrowAta.toBase58(),
  });

  if (unstakeUserDelta !== claimRaw || unstakeEscrowDelta !== -claimRaw) {
    throw new Error("UNSTAKE_TRANSFER_MISMATCH");
  }

  const allocIds = Array.isArray(allocationIds) ? allocationIds.map((id) => String(id)).filter(Boolean) : [];
  const wantedIds = new Set(allocIds);

  const allocations = wantedIds.size
    ? await prisma.allocation.findMany({
        where: {
          id: { in: [...wantedIds] },
          accountId: account.id,
          claimed: false,
        },
        include: { launch: { select: { mint: true } } },
      })
    : [];

  if (allocations.length !== wantedIds.size) {
    throw new Error("ALLOCATION_NOT_FOUND");
  }

  const sigs = Array.isArray(allocationTxSignatures)
    ? allocationTxSignatures.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];

  const parsedTxs = [];
  for (const sig of sigs) {
    parsedTxs.push({ sig, tx: await mustGetParsedConfirmedTx(sig) });
  }

  let treasury = null;

  const mintInfoCache = new Map();
  async function getMintInfoCached(mintStr) {
    if (mintInfoCache.has(mintStr)) return mintInfoCache.get(mintStr);
    const info = await getMintInfoForMint(mintStr);
    mintInfoCache.set(mintStr, info);
    return info;
  }

  const allocationSigById = new Map();
  const allocationsToMarkClaimed = [];
  for (const allocation of allocations) {
    const mintStr = String(allocation?.launch?.mint ?? "").trim();
    if (!mintStr) {
      throw new Error("LAUNCH_MINT_MISSING");
    }

    const { mintPubkey: allocMintPubkey, tokenProgramId: allocTokenProgramId, decimals: allocDecimals } =
      await getMintInfoCached(mintStr);
    const raw = parseUiAmountToRawBigInt(Number(allocation.tokenAmount), allocDecimals);
    if (raw == null || raw <= 0n) {
      continue;
    }

    if (!treasury) {
      treasury = await mustGetTreasuryWallet();
    }

    const treasuryAta = await getAssociatedTokenAddress(
      allocMintPubkey,
      treasury.pubkey,
      false,
      allocTokenProgramId
    );
    const userAllocAta = await getAssociatedTokenAddress(allocMintPubkey, userPubkey, false, allocTokenProgramId);

    let matchedSig = "";
    for (const p of parsedTxs) {
      const userDelta = getTokenBalanceDeltaForAccount({
        tx: p.tx,
        mintBase58: allocMintPubkey.toBase58(),
        accountBase58: userAllocAta.toBase58(),
      });
      const treasuryDelta = getTokenBalanceDeltaForAccount({
        tx: p.tx,
        mintBase58: allocMintPubkey.toBase58(),
        accountBase58: treasuryAta.toBase58(),
      });

      if (userDelta === raw && treasuryDelta === -raw) {
        matchedSig = p.sig;
        break;
      }
    }

    if (!matchedSig) {
      throw new Error("ALLOCATION_TRANSFER_MISMATCH");
    }

    allocationSigById.set(allocation.id, matchedSig);
    allocationsToMarkClaimed.push(allocation);
  }

  const cooldownUntil = new Date(Date.now() + COOLDOWN_SECONDS * 1000);
  const remainingStake = Number(account.stakedAmount);

  const updatedAccount = await prisma.$transaction(async (tx) => {
    const updated = await tx.stakeAccount.update({
      where: { id: account.id },
      data: {
        pendingUnstakeAmount: 0,
        unlockAt: null,
        cooldownUntil,
        stakedAt: remainingStake > 0 ? account.stakedAt : null,
      },
    });

    await tx.stakeEvent.create({
      data: {
        accountId: account.id,
        action: "claim",
        amount: claimAmt,
        txSignature: String(unstakeTxSignature ?? "").trim() || null,
      },
    });

    for (const allocation of allocationsToMarkClaimed) {
      await tx.allocation.update({
        where: { id: allocation.id },
        data: {
          claimed: true,
          claimedAt: new Date(),
          claimTxSignature: allocationSigById.get(allocation.id) || null,
        },
      });
    }

    return updated;
  });

  return {
    account: updatedAccount,
    claimAmount: claimAmt,
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
  if (!Number.isFinite(totalWeightedStake) || totalWeightedStake <= 0) {
    return [];
  }
  
  // Create allocations
  const allocations = [];
  
  const totalTokens = Number(totalTokensForStakers);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    return [];
  }

  for (const staker of stakers) {
    const sharePercent = staker.weightedStake / totalWeightedStake;
    const tokenAmount = totalTokens * sharePercent;

    const existing = await prisma.allocation.findUnique({
      where: {
        accountId_launchId: {
          accountId: staker.id,
          launchId,
        },
      },
    });

    if (!existing) {
      const created = await prisma.allocation.create({
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
      allocations.push(created);
      continue;
    }

    if (existing.claimed) {
      allocations.push(existing);
      continue;
    }

    const updated = await prisma.allocation.update({
      where: { id: existing.id },
      data: {
        stakedAtSnapshot: staker.stakedAmount,
        multiplier: staker.multiplier,
        weightedStake: staker.weightedStake,
        sharePercent,
        tokenAmount,
      },
    });
    allocations.push(updated);
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
