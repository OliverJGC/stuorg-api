-- Application tables. Supabase Auth owns the referenced auth.users table.
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_firstName_not_blank" CHECK (length(btrim("firstName")) > 0),
    CONSTRAINT "users_lastName_not_blank" CHECK (length(btrim("lastName")) > 0)
);

CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_name_not_blank" CHECK (length(btrim("name")) > 0)
);

CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_role_not_blank" CHECK (length(btrim("role")) > 0)
);

CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_id_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
