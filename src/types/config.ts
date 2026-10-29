import type { OrganizationService } from "../modules/organizations/organizationService.js";

export type RuntimeConfig = {
  corsOrigins: string[];
  databaseUrl: string;
  environment: "development" | "production" | "test";
  port: number;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type ApiMessage = {
  message: string;
};

export type AuthClient = {
  createUser(input: { email: string; password: string }): Promise<{ userId: string }>;
  deleteUser(userId: string): Promise<void>;
};

export type ApplicationDependencies = {
  organizationService: OrganizationService;
};
