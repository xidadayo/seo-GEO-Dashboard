import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

export async function ensurePrimaryWorkspace() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Workspace Owner",
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.OWNER,
    },
  });

  const existingWorkspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (existingWorkspace) return existingWorkspace;

  return prisma.workspace.create({
    data: { name: "Primary Workspace", ownerId: user.id },
  });
}
