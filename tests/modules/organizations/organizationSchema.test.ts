import { createOrganizationSchema, validateNameSchema } from "../../../src/modules/organizations/organizationSchema.js";

const validOrganizationInput = {
  name: "Engineering Club",
  admin: {
    firstName: "Alex",
    lastName: "Rivera",
    email: "alex@miners.utep.edu",
    password: "example-password",
    role: "President",
  },
};

describe("organization schemas", () => {
  it("normalizes a valid organization name", () => {
    expect(validateNameSchema.parse({ name: "  Engineering Club  " })).toEqual({
      name: "Engineering Club",
    });
  });

  it("normalizes valid organization creation input", () => {
    expect(createOrganizationSchema.parse({
      ...validOrganizationInput,
      name: "  Engineering Club  ",
      admin: {
        ...validOrganizationInput.admin,
        firstName: "  Alex  ",
        email: "  ALEX@MINERS.UTEP.EDU  ",
      },
    })).toEqual({
      ...validOrganizationInput,
      admin: {
        ...validOrganizationInput.admin,
        firstName: "Alex",
        email: "alex@miners.utep.edu",
      },
    });
  });

  it.each([
    ["a blank organization name", { name: " " }],
    ["a blank administrator name", {
      ...validOrganizationInput,
      admin: { ...validOrganizationInput.admin, firstName: " " },
    }],
    ["an email outside the UTEP domains", {
      ...validOrganizationInput,
      admin: { ...validOrganizationInput.admin, email: "alex@example.com" },
    }],
    ["a password shorter than eight characters", {
      ...validOrganizationInput,
      admin: { ...validOrganizationInput.admin, password: "short" },
    }],
  ])("rejects %s", (_description, input) => {
    expect(createOrganizationSchema.safeParse(input).success).toBe(false);
  });
});
