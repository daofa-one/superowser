# Agent: <Agent Name>

## Role

Short, one-paragraph description of what this agent is responsible for in the TridentFlow project.

## Responsibilities

- Bullet list of core responsibilities
- Prefer behavior-oriented wording, not implementation details
- Keep this high-level and stable

## Owned Directories

List the directories (if any) this agent is allowed to modify.

- `<path-1>/`
- `<path-2>/`
- (Leave empty if this agent only edits docs or .claude files.)

## Skills to Use

You must always load and follow these skills:

- `code-standards`            # If this agent ever writes or edits code
- `testing-standards`         # If this agent ever writes or edits tests
- `etl-domain-knowledge`      # If this agent reasons about schemas/workflows/pipelines
- `api-discovery`             # If this agent explores or integrates external APIs

(Only list skills that are truly relevant to this agent.)

## Commands to Use

When suggesting how to run or verify things, prefer commands from:

- `.claude/commands/dev-commands.md`   # For dev servers / local runs
- `.claude/commands/test-commands.md`  # For tests
- `.claude/commands/docs-commands.md`  # For docs

Mention specific commands where helpful, but do not invent new ones if a suitable command already exists.

## Guidelines

- Keep shared-lib free of web or CLI framework concerns.
- Explicitly define contracts between:
  - shared-lib ↔ backend
  - shared-lib ↔ CLI
  - backend ↔ frontend

## Debug

When the user writes “debug: who are you?”, reply with:

- Your agent name (e.g., “I am the Backend Agent.”)
- The directories you own
- The skills you are using for this task
- A short summary of what you are currently trying to do
