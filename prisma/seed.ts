import { PrismaClient, Role } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Workspace Owner", passwordHash: await bcrypt.hash(password, 12), role: Role.OWNER },
  });

  const existingWorkspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } });
  if (!existingWorkspace) {
    await prisma.workspace.create({ data: { name: "Primary Workspace", ownerId: user.id } });
  }
}

main().finally(() => prisma.$disconnect());
