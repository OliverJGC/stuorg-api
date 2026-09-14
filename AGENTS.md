# Backend Conventions

1. Use `src/` as the backend root and organize code by technical responsibility. Keep layer focused on its responsibility and don't move layer logic

```text
src/
├── routes/        → endpoint definitions
├── controllers/   → HTTP handling and input validation
├── services/      → application/business logic and database access
├── middleware/    → shared request lifecycle behavior
├── config/        → environment and application configuration
├── types/         → shared application types
└── utils/         → generic helpers
```

2. Keep route files limited to endpoint definitions and delegation; routes must not contain business logic.

```ts
router.get("/members", getMembers);
```
3. Let services communicate directly with the database layer rather than introducing a repository layer.

4. Use Zod in controllers as the primary request input validation mechanism, while allowing additional validation in other layers when the rule belongs there.

5. Keep shared Express middleware inside `src/middleware/` and use middleware only for cross-cutting request concerns.

6. Use API_MESSAGE in constants module and reference those constants from controllers and error handling instead of hardcoding response text.

7. Use `camelCase` for files, folders, functions, and variables; `PascalCase` for types; and `UPPER_SNAKE_CASE` for constants.

8. Prefer named exports throughout backend application code.

9. Use strict TypeScript, avoid `any`, and prefer `type` for application type definitions.

10. Never read environment variables.

11. Keep backend technical layers centralized, and colocate only narrowly scoped utils with a specific module when they are not reusable elsewhere.

12. Keep code self-documenting

13. Use dependency injection for services and external dependencies instead of tightly coupling modules to concrete implementations.

```ts
export const createMemberService = (database: DatabaseClient) => {
  // ...
};
```
