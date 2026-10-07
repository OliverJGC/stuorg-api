import type { PrismaClient } from "@prisma/client";

export type ApiMessage = {
  message: string;
};

export type ApplicationDependencies = {
  database: PrismaClient | null;
};
