import { PrivyClient } from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

let privyClient = null;

export function getPrivyClient() {
  if (!privyClient) {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
      throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
    }
    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return privyClient;
}

/**
 * Create a new Privy server wallet for a user
 * This wallet will hold their staked $DEVITO tokens
 */
export async function createEscrowWallet(userWallet) {
  const client = getPrivyClient();
  
  try {
    // Create a server-managed wallet
    const wallet = await client.walletApi.create({
      chainType: "solana",
    });
    
    return {
      id: wallet.id,
      address: wallet.address,
    };
  } catch (error) {
    console.error("Failed to create Privy escrow wallet:", error);
    throw error;
  }
}

/**
 * Get wallet details by ID
 */
export async function getEscrowWallet(walletId) {
  const client = getPrivyClient();
  
  try {
    const wallet = await client.walletApi.get(walletId);
    return wallet;
  } catch (error) {
    console.error("Failed to get Privy wallet:", error);
    throw error;
  }
}

/**
 * Sign and send a Solana transaction from the escrow wallet
 * Used for distributing launch tokens to stakers
 */
export async function sendFromEscrowWallet(walletId, transaction) {
  const client = getPrivyClient();
  
  try {
    const result = await client.walletApi.solana.signAndSendTransaction({
      walletId,
      transaction,
    });
    return result;
  } catch (error) {
    console.error("Failed to send from escrow wallet:", error);
    throw error;
  }
}
