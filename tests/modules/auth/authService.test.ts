import { jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { createAuthService } from "../../../src/modules/auth/authService.js";

const findMany = jest.fn<() => Promise<unknown>>();
const database = { membership: { findMany } } as unknown as PrismaClient;
const fetchMock = jest.fn<typeof fetch>();
const service = createAuthService(database, "https://supabase.example", "server-key");
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
});

test("validates the token and scopes memberships to the authenticated user", async () => {
  fetchMock.mockResolvedValueOnce(json({ id: "user-one" }));
  findMany.mockResolvedValueOnce([
    { organizationId: "org", organization: { name: "Club" }, role: "Member", isAdmin: false },
  ]);
  const result = await service.restore("access", "refresh");
  expect(result.memberships).toEqual([{ id: "org", name: "Club", role: "Member", isAdmin: false }]);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-one" } }));
});

test("refreshes an expired session and validates the new access token", async () => {
  fetchMock
    .mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(
      json({ access_token: "new", refresh_token: "new-refresh", expires_in: 3600 }),
    )
    .mockResolvedValueOnce(json({ id: "user-one" }));
  findMany.mockResolvedValueOnce([]);
  const result = await service.restore("expired", "refresh");
  expect(result.session).toEqual({
    accessToken: "new",
    refreshToken: "new-refresh",
    expiresIn: 3600,
  });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("rejects invalid credentials and expired refresh tokens safely", async () => {
  fetchMock.mockResolvedValueOnce(json({ message: "private provider detail" }, 400));
  await expect(service.signIn("a@utep.edu", "wrong")).rejects.toMatchObject({ status: 401 });
  fetchMock.mockResolvedValueOnce(json({}, 400));
  await expect(service.restore(undefined, "expired")).rejects.toMatchObject({ status: 401 });
});

test("distinguishes provider outages from expired sessions", async () => {
  fetchMock.mockRejectedValueOnce(new Error("network details"));
  await expect(service.restore("access", "refresh")).rejects.toMatchObject({ status: 503 });
  expect(findMany).not.toHaveBeenCalled();
});

test("revokes the current provider session on sign-out", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ id: "user-one" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  await service.signOut("access", "refresh");
  expect(fetchMock.mock.calls[1]?.[0]).toContain("logout?scope=local");
});
