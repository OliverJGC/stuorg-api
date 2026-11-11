# API Conventions

1. Use `API_MESSAGE` from the constants module for client-facing response messages in controllers and error handling.

2. Use camelCase for files, folders, functions, and variables; PascalCase for types; and UPPER_SNAKE_CASE for constants.

3. Prefer named exports throughout backend application code.

4. Use strict TypeScript, avoid `any`, and prefer `type` for application type definitions.

5. Write straightforward, self-documenting code with clear names and well-defined function signatures.

6. Test services and Zod schemas with unit tests, and controllers and routes together with integration tests. Cover success cases, errors, and edge cases without redundant tests.

7. Use blank lines to separate logical sections, keep closely related statements together, and avoid unnecessary line wrapping. Follow the spacing and formatting in `src/infrastructure/createDependencies.ts`.

8. Use `getLogger()` for request-aware Pino logs. Don’t log sensitive data.

9. Use controlled log messages and structured fields for safe operation names, recognized provider codes, and statuses. Include an operation name and status when available, and prefix the message with the file name. For example:

   ```ts
   getLogger().info({ operation: "createOrganizationController", status: 201 }, "[organizationController] Returning organization creation response");
   ```

10. Let HTTP middleware log the final request outcome. Controllers may also log the response they intend to return.

11. Log dependency failures once and service decisions separately.

12. Log schema validation failures as warnings. Never log the request body or its values.

13. Write controller success messages about the response being returned. Write service success messages about the business or database action completed.
