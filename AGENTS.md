# Guidelines for Codex

## Testing
- Run `npm test` before committing any changes to ensure tests pass.
- Use `npm run lint` and `npm run format:check` to verify code style.

## Style
- Follow the existing ESLint and Prettier configuration.
- Use single quotes and semicolons as enforced by `.prettierrc`.

## Commits
- Write concise commit messages in English, using the imperative mood.
- Describe what was changed and why, e.g. `Add login route`.

## Notes
- The project requires Node.js 20 or higher. Use `npm ci` to install dependencies.
- Main development happens on the `dev` branch; production code lives on `main`.
