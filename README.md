<p align="center">
  <img src="assets/banner.png" alt="DevFlow CLI" width="100%">
</p>

# DevFlow CLI

A privacy-aware AI assistant for software projects, built for developers who want structured implementation plans, safer code changes, and automated project checks from the terminal.

## Features

- **Project Analysis** — Understands repository structure, language, and configuration before making recommendations
- **Implementation Plans** — Generates step-by-step plans from natural-language requests
- **Safe File Changes** — Dry-run preview by default; changes only applied with `--apply`
- **Error Explanation** — Analyzes errors and suggests specific fixes
- **Test & Lint Runner** — Executes project checks and reports results
- **PR Draft Generation** — Creates pull-request descriptions with change summaries
- **Multi-Provider LLM** — Switchable providers for flexibility and privacy

## Supported LLM Providers

| Provider | Mode | Default Model |
|----------|------|---------------|
| Ollama | Local (offline) | codellama:7b |
| OpenAI | Cloud | gpt-4o |
| Anthropic | Cloud | claude-sonnet-4-20250514 |
| Gemini | Cloud | gemini-2.0-flash |
| Local (llama.cpp) | Local | Custom model |

## Installation

```bash
git clone https://github.com/husam20264-cmd/DevFlow-CLI.git
cd DevFlow-CLI
npm install
node bin/devflow.js --help
```

## Commands

### Setup

```bash
devflow setup
```

Analyzes the current project and displays language, file count, and configuration.

### Plan

```bash
devflow plan "Add JWT authentication"
```

Generates a step-by-step implementation plan. Default mode is **dry-run** — shows what would change without writing files.

```bash
devflow plan "Add user roles" --apply
```

Use `--apply` to execute the plan.

### Explain

```bash
devflow explain error.log
cat error.log | devflow explain
```

Analyzes error output and provides explanation, root cause, and fix suggestions.

### Check

```bash
devflow check
```

Runs tests and lint checks using the project's configured scripts.

### PR

```bash
devflow pr -d "Add authentication system"
```

Generates a PR draft with title, description, file changes, and checklist.

## Safety Model

DevFlow is designed to be **review-first**:

- **Dry-run by default** — Plans are shown before any file is modified
- **Sensitive file protection** — Modifications to `.env`, credentials, and keys require confirmation
- **Path traversal prevention** — Cannot access files outside the project directory
- **Hardcoded secret detection** — Warns when code contains potential API keys or passwords
- **Dangerous command blocking** — `rm -rf`, `sudo`, `git push --force` require explicit approval
- **Backup system** — Creates backups before modifying existing files

## Configuration

DevFlow stores configuration in `~/.devflow/config.json`:

```json
{
  "activeProvider": "ollama",
  "providers": {
    "openai": { "apiKey": "env:OPENAI_API_KEY" }
  }
}
```

## Project Structure

```
devflow-cli/
├── bin/devflow.js              # CLI entry point
├── src/
│   ├── core/
│   │   ├── engine.js           # Main orchestration engine
│   │   ├── project-analyzer.js # Repository structure analysis
│   │   ├── file-changer.js     # Safe file modifications with backup
│   │   ├── safety-guard.js     # Command and file protection
│   │   ├── test-runner.js      # Test and lint execution
│   │   └── pr-generator.js     # Pull-request draft generation
│   ├── providers/
│   │   └── llm-manager.js      # Multi-provider LLM system
│   └── commands/
│       └── index.js            # CLI command implementations
├── tests/
│   └── cli.test.js             # Test suite (21 tests)
└── package.json
```

## Testing

```bash
npm test
```

Run the full test suite covering project analysis, safety guards, file changes, PR generation, and engine initialization.

## Use Cases

- **Feature Planning** — Convert requirements into structured implementation steps
- **Repository Onboarding** — Understand unfamiliar codebases quickly
- **Code Review Prep** — Generate PR descriptions and check summaries
- **Error Debugging** — Get explanations and fix suggestions for cryptic errors
- **Team Workflows** — Standardize how changes are planned and documented

## License

MIT
