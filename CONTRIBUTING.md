# Contributing to OpenInt Sandarb

Thank you for your interest in contributing to OpenInt Sandarb! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/openint/openint-sandarb/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, browser)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Use case description
   - Proposed solution
   - Alternative approaches considered

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests and linting: `npm run lint`
5. Commit with clear messages
6. Push and create a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/openint-sandarb.git
cd openint-sandarb

# Install dependencies
npm install

# Start development server
npm run dev
```

### Seed data (Postgres)

- Run `npm run db:full-reset-pg` to reset and seed sample data.
- **Agent names must differ per org.** In `scripts/seed-postgres.js`, each organization gets its own set of agent names (e.g. org name + role); never reuse the same agent name list across orgs.

### Optional: GCP deploy (gcloud CLI)

To deploy to GCP (e.g. `./scripts/deploy-gcp.sh 191433138534`), install the Google Cloud SDK:

**macOS (Homebrew):**
```bash
brew install --cask google-cloud-sdk
```

Then log in and set your project:
```bash
gcloud auth login
gcloud config set project 191433138534
```

See [docs/deploy-gcp.md](docs/deploy-gcp.md) for full deploy steps.

## Coding Standards

### TypeScript

- Use strict TypeScript (no `any` unless absolutely necessary)
- Define types in `types/index.ts`
- Use interfaces for objects, types for unions/primitives

### React/Next.js

- Use functional components with hooks
- Prefer Server Components where possible
- Keep components small and focused

### Styling

- Use Tailwind CSS utility classes
- Follow shadcn/ui patterns for new components
- Support both light and dark modes

### Commits

Follow conventional commits:

```
feat: add context search functionality
fix: resolve database connection timeout
docs: update API documentation
refactor: simplify context validation logic
```

## Project Structure

```
├── app/           # Next.js pages and API routes
├── components/    # React components
│   └── ui/        # shadcn/ui base components
├── lib/           # Core utilities and database
├── types/         # TypeScript type definitions
└── public/        # Static assets
```

## Testing

Before submitting a PR:

1. Ensure the app builds: `npm run build`
2. Check for lint errors: `npm run lint`
3. Test new features manually
4. Verify dark mode compatibility

## Getting Help

- Open an issue for questions
- Join our community discussions
- Tag maintainers for urgent matters

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions

Thank you for helping make OpenInt Sandarb better!
