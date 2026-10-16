import { PrismaClient } from "@prisma/client";
import { DEFAULT_CREDIT_ACTIONS, DEFAULT_CREDIT_PACKS, DEFAULT_PLANS } from "../src/server/billing/catalog";

const prisma = new PrismaClient();

async function main() {
  // Upsert keeps existing rows' edited prices: only create if missing.
  for (const a of DEFAULT_CREDIT_ACTIONS) {
    await prisma.creditAction.upsert({ where: { key: a.key }, create: a, update: {} });
  }
  for (const p of DEFAULT_PLANS) {
    await prisma.plan.upsert({ where: { key: p.key }, create: { ...p }, update: {} });
  }
  if ((await prisma.creditPack.count()) === 0) {
    await prisma.creditPack.createMany({ data: DEFAULT_CREDIT_PACKS.map((p) => ({ ...p })) });
  }
  console.log("Seeded credit actions, plans and credit packs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
