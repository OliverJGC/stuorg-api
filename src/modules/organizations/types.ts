export type OrgNameValidationResult = {
  name: string;
  available: boolean;
};

export type CreateOrganizationInput = {
  name: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  };
};

export type OrganizationCreationResult = {
  organization: {
    id: string;
    name: string;
  };
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
};
