import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MAYHEM_PROGRAM_ID = new PublicKey("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");
const FEE_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

const CREATE_V2_DISCRIMINATOR = Buffer.from([214, 144, 76, 236, 95, 139, 49, 180]);
const EXTEND_ACCOUNT_DISCRIMINATOR = Buffer.from([234, 102, 194, 203, 150, 72, 62, 229]);
const BUY_EXACT_SOL_IN_DISCRIMINATOR = Buffer.from([56, 252, 116, 8, 158, 223, 205, 95]);
const ATA_CREATE_IDEMPOTENT = Buffer.from([1]);

const MINT_AUTHORITY_SEED = Buffer.from("mint-authority");
const GLOBAL_SEED = Buffer.from("global");
const BONDING_CURVE_SEED = Buffer.from("bonding-curve");
const GLOBAL_VOLUME_ACCUMULATOR_SEED = Buffer.from("global_volume_accumulator");
const USER_VOLUME_ACCUMULATOR_SEED = Buffer.from("user_volume_accumulator");
const MAYHEM_GLOBAL_PARAMS_SEED = Buffer.from("global-params");
const MAYHEM_SOL_VAULT_SEED = Buffer.from("sol-vault");
const MAYHEM_STATE_SEED = Buffer.from("mayhem-state");
const FEE_CONFIG_SEED = Buffer.from("fee_config");
const FEE_CONFIG_ID_SEED = Buffer.from([
  1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
]);
const CREATOR_VAULT_SEED = Buffer.from("creator-vault");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

export function getPumpProgramId() {
  return PUMP_PROGRAM_ID;
}

export function getPumpEventAuthorityPda() {
  const [pda] = PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], PUMP_PROGRAM_ID);
  return pda;
}

export function getPumpGlobalPda() {
  const [pda] = PublicKey.findProgramAddressSync([GLOBAL_SEED], PUMP_PROGRAM_ID);
  return pda;
}

export function getPumpMintAuthorityPda() {
  const [pda] = PublicKey.findProgramAddressSync([MINT_AUTHORITY_SEED], PUMP_PROGRAM_ID);
  return pda;
}

export function getBondingCurvePda(mint) {
  const [pda] = PublicKey.findProgramAddressSync([BONDING_CURVE_SEED, mint.toBuffer()], PUMP_PROGRAM_ID);
  return pda;
}

export function getGlobalVolumeAccumulatorPda() {
  const [pda] = PublicKey.findProgramAddressSync([GLOBAL_VOLUME_ACCUMULATOR_SEED], PUMP_PROGRAM_ID);
  return pda;
}

export function getUserVolumeAccumulatorPda(user) {
  const [pda] = PublicKey.findProgramAddressSync([USER_VOLUME_ACCUMULATOR_SEED, user.toBuffer()], PUMP_PROGRAM_ID);
  return pda;
}

export function getMayhemGlobalParamsPda() {
  const [pda] = PublicKey.findProgramAddressSync([MAYHEM_GLOBAL_PARAMS_SEED], MAYHEM_PROGRAM_ID);
  return pda;
}

export function getMayhemSolVaultPda() {
  const [pda] = PublicKey.findProgramAddressSync([MAYHEM_SOL_VAULT_SEED], MAYHEM_PROGRAM_ID);
  return pda;
}

export function getMayhemStatePda(mint) {
  const [pda] = PublicKey.findProgramAddressSync([MAYHEM_STATE_SEED, mint.toBuffer()], MAYHEM_PROGRAM_ID);
  return pda;
}

export function getFeeConfigPda() {
  const [pda] = PublicKey.findProgramAddressSync([FEE_CONFIG_SEED, FEE_CONFIG_ID_SEED], FEE_PROGRAM_ID);
  return pda;
}

export function getCreatorVaultPda(creator) {
  const [pda] = PublicKey.findProgramAddressSync([CREATOR_VAULT_SEED, creator.toBuffer()], PUMP_PROGRAM_ID);
  return pda;
}

export function getAssociatedTokenAddress({ owner, mint, tokenProgram }) {
  const program = tokenProgram ?? TOKEN_2022_PROGRAM_ID;
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), program.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}

function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function u64le(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
}

function toU8(part) {
  return Uint8Array.from(part);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = Buffer.alloc(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function borshString(s) {
  const bytes = Buffer.from(String(s ?? ""), "utf8");
  return concatBytes([toU8(u32le(bytes.length)), toU8(bytes)]);
}

function borshOptionBool(v) {
  return Buffer.from([1, v ? 1 : 0]);
}

export function buildCreateV2Instruction({ mint, user, name, symbol, uri, creator, isMayhemMode }) {
  const mintAuthority = getPumpMintAuthorityPda();
  const bondingCurve = getBondingCurvePda(mint);
  const associatedBondingCurve = getAssociatedTokenAddress({ owner: bondingCurve, mint, tokenProgram: TOKEN_2022_PROGRAM_ID });
  const global = getPumpGlobalPda();
  const globalParams = getMayhemGlobalParamsPda();
  const solVault = getMayhemSolVaultPda();
  const mayhemState = getMayhemStatePda(mint);
  const mayhemTokenVault = getAssociatedTokenAddress({ owner: solVault, mint, tokenProgram: TOKEN_2022_PROGRAM_ID });
  const eventAuthority = getPumpEventAuthorityPda();

  const data = concatBytes(
    [
      CREATE_V2_DISCRIMINATOR,
      borshString(name),
      borshString(symbol),
      borshString(uri),
      creator.toBuffer(),
      Buffer.from([isMayhemMode ? 1 : 0]),
    ].map(toU8)
  );

  const ix = new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: global, isSigner: false, isWritable: false },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MAYHEM_PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: globalParams, isSigner: false, isWritable: false },
      { pubkey: solVault, isSigner: false, isWritable: true },
      { pubkey: mayhemState, isSigner: false, isWritable: true },
      { pubkey: mayhemTokenVault, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  return { ix, bondingCurve, associatedBondingCurve };
}

export function buildExtendAccountInstruction({ account, user }) {
  const eventAuthority = getPumpEventAuthorityPda();
  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: EXTEND_ACCOUNT_DISCRIMINATOR,
  });
}

export function buildCreateAssociatedTokenAccountIdempotentInstruction({ payer, owner, mint, tokenProgram }) {
  const program = tokenProgram ?? TOKEN_2022_PROGRAM_ID;
  const ata = getAssociatedTokenAddress({ owner, mint, tokenProgram: program });
  const ix = new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: program, isSigner: false, isWritable: false },
    ],
    data: ATA_CREATE_IDEMPOTENT,
  });
  return { ix, ata };
}

async function getGlobalFeeRecipient(connection) {
  const global = getPumpGlobalPda();
  const acct = await connection.getAccountInfo(global, "confirmed");
  if (!acct?.data || acct.data.length < 8 + 1 + 32 + 32) {
    throw new Error("Failed to read pump.fun global state");
  }
  const feeRecipientBytes = acct.data.subarray(8 + 1 + 32, 8 + 1 + 32 + 32);
  return new PublicKey(feeRecipientBytes);
}

export function buildBuyExactSolInInstruction({
  user,
  mint,
  bondingCurve,
  associatedBondingCurve,
  associatedUser,
  feeRecipient,
  creator,
  spendableSolInLamports,
  minTokensOut,
  trackVolume = true,
}) {
  const global = getPumpGlobalPda();
  const eventAuthority = getPumpEventAuthorityPda();
  const creatorVault = getCreatorVaultPda(creator);
  const globalVolumeAccumulator = getGlobalVolumeAccumulatorPda();
  const userVolumeAccumulator = getUserVolumeAccumulatorPda(user);
  const feeConfig = getFeeConfigPda();

  const data = concatBytes(
    [
      BUY_EXACT_SOL_IN_DISCRIMINATOR,
      u64le(BigInt(spendableSolInLamports)),
      u64le(BigInt(minTokensOut)),
      borshOptionBool(trackVolume),
    ].map(toU8)
  );

  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: global, isSigner: false, isWritable: false },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: false },
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
      { pubkey: feeConfig, isSigner: false, isWritable: false },
      { pubkey: FEE_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function buildUnsignedPumpfunCreateV2Tx({
  connection,
  user,
  mint,
  name,
  symbol,
  uri,
  creator,
  isMayhemMode = false,
  spendableSolInLamports,
  minTokensOut = 1n,
  computeUnitLimit = 199613,
  computeUnitPriceMicroLamports = 936761,
}) {
  const feeRecipient = await getGlobalFeeRecipient(connection);

  const { ix: createIx, bondingCurve, associatedBondingCurve } = buildCreateV2Instruction({
    mint,
    user,
    name,
    symbol,
    uri,
    creator,
    isMayhemMode,
  });

  const extendIx = buildExtendAccountInstruction({ account: bondingCurve, user });

  const { ix: createAtaIx, ata: associatedUser } = buildCreateAssociatedTokenAccountIdempotentInstruction({
    payer: user,
    owner: user,
    mint,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });

  const spendable = BigInt(spendableSolInLamports);
  const buyIx =
    spendable > 0n
      ? buildBuyExactSolInInstruction({
          user,
          mint,
          bondingCurve,
          associatedBondingCurve,
          associatedUser,
          feeRecipient,
          creator,
          spendableSolInLamports: spendable,
          minTokensOut: BigInt(minTokensOut ?? 0n),
          trackVolume: true,
        })
      : null;

  const tx = new Transaction();
  tx.feePayer = user;

  const cuLimit = Math.max(50_000, Math.min(1_400_000, Number(computeUnitLimit)));
  const cuPrice = Math.max(0, Math.min(50_000_000, Number(computeUnitPriceMicroLamports)));

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }));
  tx.add(createIx);
  tx.add(extendIx);
  tx.add(createAtaIx);
  if (buyIx) tx.add(buyIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  return { tx, bondingCurve, associatedBondingCurve, associatedUser, feeRecipient };
}

export async function buildUnsignedPumpfunBuyTx({
  connection,
  user,
  mint,
  creator,
  spendableSolInLamports,
  minTokensOut = 0n,
  computeUnitLimit = 199613,
  computeUnitPriceMicroLamports = 936761,
}) {
  const feeRecipient = await getGlobalFeeRecipient(connection);
  const bondingCurve = getBondingCurvePda(mint);
  const associatedBondingCurve = getAssociatedTokenAddress({ owner: bondingCurve, mint, tokenProgram: TOKEN_2022_PROGRAM_ID });
  const associatedUser = getAssociatedTokenAddress({ owner: user, mint, tokenProgram: TOKEN_2022_PROGRAM_ID });

  const { ix: createAtaIx } = buildCreateAssociatedTokenAccountIdempotentInstruction({
    payer: user,
    owner: user,
    mint,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });

  const buyIx = buildBuyExactSolInInstruction({
    user,
    mint,
    bondingCurve,
    associatedBondingCurve,
    associatedUser,
    feeRecipient,
    creator,
    spendableSolInLamports: BigInt(spendableSolInLamports),
    minTokensOut: BigInt(minTokensOut),
    trackVolume: true,
  });

  const tx = new Transaction();
  tx.feePayer = user;

  const cuLimit = Math.max(50_000, Math.min(1_400_000, Number(computeUnitLimit)));
  const cuPrice = Math.max(0, Math.min(50_000_000, Number(computeUnitPriceMicroLamports)));

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }));
  tx.add(createAtaIx);
  tx.add(buyIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  return { tx, bondingCurve, associatedBondingCurve, associatedUser, feeRecipient };
}
