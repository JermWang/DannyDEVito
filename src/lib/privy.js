import { privyCreateSolanaWallet, privyGetWallet } from "./privyServer";

/**
 * Create a new Privy server wallet for a user
 * This wallet will hold their staked $DEVITO tokens
 */
export async function createEscrowWallet(userWallet) {
  try {
    const wallet = await privyCreateSolanaWallet();
    return {
      id: wallet.walletId,
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
  try {
    const wallet = await privyGetWallet(walletId);
    return wallet;
  } catch (error) {
    console.error("Failed to get Privy wallet:", error);
    throw error;
  }
}
