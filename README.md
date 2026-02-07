# TS Template

A modern TypeScript template with Bun, Biome, and pre-configured tooling.

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript (strict mode)
- **Linting/Formatting:** [Biome](https://biomejs.dev)
- **Git Hooks:** Husky + lint-staged + commitlint
- **Markdown Linting:** markdownlint

## Prerequisites

- [Bun](https://bun.sh) v1.3.4 or later

## Getting Started

### Using `bun create` (recommended)

```bash
bun create jorduino/ts-template myproject
```

An interactive setup wizard will guide you through project configuration.

### Manual setup

1. Click **"Use this template"** on GitHub to create your own repository
2. Clone your new repository
3. Install dependencies and run the setup wizard:

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
bun install
bun setup/setup.ts
```

## Scripts

| Command          | Description                  |
| ---------------- | ---------------------------- |
| `bun start`      | Run the project              |
| `bun test`       | Run tests                    |
| `bun run lint`   | Check for lint/format issues |
| `bun run format` | Fix lint/format issues       |

## Project Structure

```text
├── src/            # Source code
├── tests/          # Test files
├── .husky/         # Git hooks
│   ├── pre-commit  # Runs tests before commit
│   └── commit-msg  # Validates commit message format
└── biome.jsonc     # Biome config (linting/formatting)
```

## Commit Convention

This template uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated automatically.

```text
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance tasks
```

## License

Apache-2.0
