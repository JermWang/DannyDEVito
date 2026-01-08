/**
 * One-time script to seed the first manual Launch row for $DEVITO.
 * Run with: node scripts/seed-first-launch.js
 *
 * After running, you can update pumpUrl and launchTxSignature via Prisma Studio
 * or a follow-up script once you have those values.
 */

require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const mint = "9DpzSfPkgmYGq3KqKCbvaqrMiZhJoHcU24PihTN2pump";
  const name = "Danny DEVito";
  const ticker = "DEVITO";

  // Check if already exists
  const existing = await prisma.launch.findFirst({
    where: { mint },
  });

  if (existing) {
    console.log("Launch already exists:", existing.id);
    console.log(existing);
    return;
  }

  const launch = await prisma.launch.create({
    data: {
      name,
      ticker,
      mint,
      status: "launched",
      launchedAt: new Date(),
      // pumpUrl and launchTxSignature will be added later
      // totalSupply and stakerShare can be set if needed for allocations
    },
  });

  console.log("Created Launch:");
  console.log(launch);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
