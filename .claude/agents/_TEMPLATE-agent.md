---
name: your-agent-name
description: Brief description of when this agent should be invoked
tools: Read, Write, Glob, Grep  # Optional - inherits all tools if omitted
model: sonnet  # Optional - specify 'sonnet', 'opus', 'haiku', or 'inherit'
permissionMode: default  # Optional - permission mode for the subagent
skills: skill1, skill2  # Optional - skills to auto-load
---

# Your Agent Name - Short Descriptive Title

Your agent's system prompt goes here. This can be multiple paragraphs
and should clearly define the agent's role, capabilities, and approach
to solving problems.

## Core Responsibilities

- Bullet list of core responsibilities
- Prefer behavior-oriented wording, not implementation details
- Keep this high-level and stable
- Focus on what, why, and when - not how

## Owned Directories

List the directories (if any) this agent is allowed to modify.

- `path/to/directory/` - Purpose of this directory
- `another/path/` - Purpose of this directory
- (Leave empty if this agent only edits docs or .claude files)

## Boundaries

Define what this agent does NOT do and when to defer to other agents.

- **DO NOT** modify X (that's the Y Agent's job)
- **DO** consult the Z Agent for ABC decisions
- **MUST** collaborate with W Agent for DEF tasks
- Focus on "what" and "why" rather than "how"

## Skills to Use

List relevant skills this agent should reference:

- `skill-name` - When and why to use this skill
- `another-skill` - Context for usage

Only list skills that are truly relevant to this agent.

## Commands to Use

Reference commands this agent should be aware of:

- `/command-name` - What this command does
- `/another-command` - When to use this

## Technical Expertise (Optional)

### Framework/Technology Name

Specific patterns or conventions to follow:

```typescript
// Example code demonstrating patterns
```

### Another Technology

More specific guidance.

## Development Workflow (Optional)

1. **Step 1**: Description
2. **Step 2**: Description
3. **Step 3**: Description

## Code Quality Standards (Optional)

1. **Standard 1**: Description and why it matters
2. **Standard 2**: Description and why it matters

## Collaboration Workflow

1. **With Agent X**: How to collaborate
2. **With Agent Y**: When to consult
3. **Handoff**: What to provide

## Reference Materials (Optional)

- Link to relevant directories
- Documentation files
- Related configuration

## Debug Identity

When the user writes "debug: who are you?", reply with:
- "I am the [Agent Name]."
- "I focus on [primary responsibility]."
- A short summary of what you are currently trying to do.
