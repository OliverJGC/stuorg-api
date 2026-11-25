import { jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { createAuthService } from "../../../src/modules/auth/authService.js";

const findMany = jest.fn<() => Promise<unknown>>();
const findUniqueOrThrow = jest.fn<() => Promise<unknown>>();
const database = {
  user: { findUniqueOrThrow },
  membership: { findMany },
} as unknown as PrismaClient;
const user = { id: "user-one", firstName: "Alex", lastName: "Rivera" };
const fetchMock = jest.fn<typeof fetch>();
const service = createAuthService(database, "https://supabase.example", "server-key");
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
  findUniqueOrThrow.mockResolvedValue(user);
});

test("validates the token and scopes memberships to the authenticated user", async () => {
  fetchMock.mockResolvedValueOnce(json({ id: "user-one" }));
  findMany.mockResolvedValueOnce([
    { organizationId: "org", organization: { name: "Club" }, role: "Member", isAdmin: false },
  ]);
  const result = await service.restore("access", "refresh");
  expect(result.user).toEqual(user);
  expect(findUniqueOrThrow).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: user.id } }),
  );
  expect(result.memberships).toEqual([{ id: "org", name: "Club", role: "Member", isAdmin: false }]);
  expect(result).toHaveProperty("refreshedSession", undefined);
  expect(fetchMock).toHaveBeenCalledTimes(1);
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
  expect(result.user).toEqual(user);
  expect(result.memberships).toEqual([]);
  expect(result.refreshedSession).toEqual({
    accessToken: "new",
    refreshToken: "new-refresh",
    expiresIn: 3600,
  });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("propagates profile lookup errors", async () => {
  const error = new Error("Record not found");
  fetchMock.mockResolvedValueOnce(json({ id: "user-one" }));
  findUniqueOrThrow.mockRejectedValueOnce(error);
  await expect(service.restore("access", "refresh")).rejects.toBe(error);
  expect(findMany).not.toHaveBeenCalled();
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

test.each([400, 429, 500])("maps provider session failure %i", async (status) => {
  fetchMock.mockResolvedValueOnce(json({}, status));
  await expect(service.signIn("a@utep.edu", "secret")).rejects.toMatchObject({
    status: status === 500 ? 503 : status === 429 ? 429 : 401,
  });
});

test.each([
  {},
  { access_token: "a" },
  { access_token: "a", refresh_token: "r" },
  { access_token: "a", refresh_token: "r", expires_in: 0 },
])("rejects malformed provider sessions", async (payload) => {
  fetchMock.mockResolvedValueOnce(json(payload));
  await expect(service.signIn("a@utep.edu", "secret")).rejects.toMatchObject({ status: 503 });
});

test.each([json({}, 500), new Response("invalid"), json({}), json({ id: "" })])(
  "rejects provider user lookup failures",
  async (response) => {
    fetchMock.mockResolvedValueOnce(response);
    await expect(service.restore("access", undefined)).rejects.toMatchObject({ status: 503 });
  },
);

test("rejects a missing or forbidden session", async () => {
  await expect(service.restore(undefined, undefined)).rejects.toMatchObject({ status: 401 });
  fetchMock.mockResolvedValueOnce(json({}, 403));
  await expect(service.restore("access", undefined)).rejects.toMatchObject({ status: 401 });
});

test("signs out using a refreshed token", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ access_token: "new", refresh_token: "r", expires_in: 1 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  await service.signOut(undefined, "refresh");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([400, 500])("handles refresh failure %i during sign out", async (status) => {
  fetchMock.mockResolvedValueOnce(json({}, status));
  const result = service.signOut(undefined, "refresh");
  if (status === 400) {
    await expect(result).resolves.toBeUndefined();
  } else {
    await expect(result).rejects.toMatchObject({ status: 503 });
  }
});

test("handles sign out without a token and provider logout failures", async () => {
  await expect(service.signOut(undefined, undefined)).resolves.toBeUndefined();
  fetchMock.mockResolvedValueOnce(json({ id: "user-one" })).mockResolvedValueOnce(json({}, 500));
  await expect(service.signOut("access", undefined)).rejects.toMatchObject({ status: 503 });
});
