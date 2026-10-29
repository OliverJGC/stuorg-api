# API Conventions

1. Use API_MESSAGE from the constants module instead of hardcoding client-facing response messages in controllers or error handling.

2. Use camelCase for files, folders, functions, and variables; PascalCase for types; and UPPER_SNAKE_CASE for constants.

3. Prefer named exports throughout backend application code.

4. Use strict TypeScript, avoid any, and prefer type for application type definitions.

5. Keep code self-documenting.

6. Keep code human-readable, not machine-readable.

7. Write straightforward code that is easy to follow, with clear variable names and well-defined function signatures.

8. Test services and Zod schemas with unit tests, and controllers and routes together with integration tests. Cover success cases, errors, and edge cases without redundant tests.