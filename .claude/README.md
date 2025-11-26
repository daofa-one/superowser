# Superowser Claude Code Configuration

This directory contains specialized agents, skills, and commands for working with Claude Code on the Superowser project.

## Directory Structure

```
.claude/
├── agents/              # Specialized AI agents for different domains
├── skills/              # Cross-cutting knowledge and patterns
├── commands/            # Slash commands for common workflows
├── SKILLS_ROADMAP.md    # Planned skills and prioritization
└── README.md            # This file
```

---

## Agents

Agents are specialized assistants with specific domains of expertise. The system uses a **Coordinator Agent** that routes tasks to specialized agents and orchestrates their collaboration.

### Agent Hierarchy

```
Coordinator Agent (Main)
├── UX Agent (design & interaction)
├── Frontend Agent (implementation)
├── Data Agent (data & algorithms)
├── Code Review Agent (quality assurance)
├── Refactor Agent (code improvement)
└── CC Artifact Agent (meta-configuration)
```

### Available Agents

| Agent | File | Focus | When Active |
|-------|------|-------|-------------|
| **Coordinator Agent** | `agents/coordinator-agent.md` | Task routing, orchestration, synthesis | Always (default) |
| **UX Agent** | `agents/ux-agent.md` | Human-computer interaction, usability, accessibility | When routed by Coordinator |
| **Frontend Agent** | `agents/frontend-agent.md` | Vue.js, Chrome extensions, TypeScript, CSS | When routed by Coordinator |
| **Data Agent** | `agents/data-agent.md` | Database schema, search algorithms, data organization | When routed by Coordinator |
| **Code Review Agent** | `agents/code-review-agent.md` | Code quality, security, standards compliance | After significant code changes |
| **Refactor Agent** | `agents/refactor-agent.md` | Code restructuring, optimization, technical debt | After code review findings |
| **CC Artifact Agent** | `agents/CC-artifact-agent.md` | Maintains `.claude/` configuration files | When routed by Coordinator |

### Using Agents

The **Coordinator Agent** is always active by default. It analyzes your request and routes to the appropriate specialist(s):

```
# Coordinator automatically routes based on task
"Design the tag autocomplete UI"  → Coordinator routes to UX Agent
"Implement the ChatBox component" → Coordinator routes to Frontend Agent
"Optimize the search ranking"     → Coordinator routes to Data Agent

# Explicitly request a specific agent
"@ux-agent: Review the side panel layout"
"@frontend-agent: Fix the message passing bug"
"@data-agent: Analyze the search performance"

# Complex tasks trigger orchestration
"Add a related pages feature"     → Coordinator orchestrates: UX → Data → Frontend
```

See `agents/routing.md` for detailed routing logic and `commands/agent-routing.md` for usage guidelines.

---

## Skills

Skills are reusable knowledge documents that define patterns, conventions, and best practices used across the project. Each skill is a **folder** containing a `SKILL.md` file and optional supporting files (templates, scripts, examples).

### Skill Structure

```
.claude/skills/
├── skill-name/
│   ├── SKILL.md              # Main skill documentation
│   ├── templates/            # Optional: Code templates
│   ├── scripts/              # Optional: Helper scripts
│   └── examples.md           # Optional: Additional examples
```

### Core Skills ✅

1. **browser-extension-patterns/** - Chrome extension architecture, contexts, message passing
   - Main patterns for Manifest V3 development

2. **vue-component-standards/** - Vue 3 Composition API patterns and conventions
   - Includes component and composable templates

3. **search-algorithms/** - Fuzzy matching, ranking, context-aware search
   - Includes detailed examples

4. **tagging-system/** - Tags, shortcuts, and tasks/collections
   - Core organizational model

5. **omnibox-command-syntax/** - Omnibox command patterns and parsing
   - Command grammar and autocomplete

6. **message-protocol/** - Message passing between extension contexts
   - Standardized message types

### Skill Categories

**Domain Knowledge**:
- `tagging-system/` - How the organizational system works
- `omnibox-command-syntax/` - Search and navigation patterns

**Technical Patterns**:
- `browser-extension-patterns/` - Extension architecture
- `vue-component-standards/` - Vue 3 patterns
- `message-protocol/` - Inter-context communication
- `search-algorithms/` - Search and ranking

See `SKILLS_ROADMAP.md` for planned skills.

---

## Commands

Slash commands provide quick access to common workflows and documentation.

### Available Commands

- `/dev` - Start development server
- `/build` - Build for production
- `/agent-routing` - Guide for routing tasks to agents

### Creating a Command

1. Create `.claude/commands/your-command.md`
2. Add front matter:
   ```yaml
   ---
   description: Brief description of what this command does
   ---
   ```
3. Add command content (markdown)
4. Use in Claude Code: `/your-command`

---

## Workflow Patterns

### For New Features

1. **UX Agent** - Design the user interaction
2. **Data Agent** - Design data model and algorithms
3. **Frontend Agent** - Implement the UI and logic

Example:
```
User: "Add a feature to track page access frequency"

1. UX Agent designs how frequency is displayed
2. Data Agent adds accessCount field and tracking logic
3. Frontend Agent implements the UI display
```

### For Bug Fixes

Route directly to the appropriate agent:

- **Interaction bugs** → UX Agent
- **Implementation bugs** → Frontend Agent
- **Search/data bugs** → Data Agent

### For Refactoring

- **UI refactoring** → Frontend Agent (consult UX Agent if patterns change)
- **Data refactoring** → Data Agent
- **Architectural changes** → Multiple agents collaborating

---

## Maintaining This System

### When to Create a New Skill

Create a skill when you notice:
- A pattern used in 3+ places
- Domain knowledge that multiple agents need
- A convention that should be standardized
- Architecture decisions that should be documented

**Process**:
1. Create folder: `.claude/skills/skill-name/`
2. Create `SKILL.md` with template:
   ```markdown
   # Skill: Skill Name

   ## Overview
   Brief description

   ## Core Patterns
   Concrete examples with code

   ## Usage
   How and when to apply

   ## Related Files
   Links to implementation

   ## Common Pitfalls
   What to avoid
   ```
3. Add supporting files:
   - `templates/` - Code templates
   - `scripts/` - Helper scripts
   - `examples.md` - Additional examples
4. Update `SKILLS_ROADMAP.md`
5. Reference in relevant agents

### When to Create a New Agent

Create an agent when:
- A new domain requires specialized expertise
- Existing agents' boundaries are unclear
- A cross-cutting concern needs ownership

**Don't** create agents for:
- One-off tasks
- Narrow tool usage
- Implementation details (use skills instead)

### When to Create a New Command

Create a command for:
- Frequently used workflows
- Complex multi-step operations
- Quick reference documentation

---

## Best Practices

### For Users

1. **Trust the routing** - Let Claude Code route tasks to appropriate agents
2. **Be specific** - Clear requests get better results
3. **Reference skills** - Point agents to relevant skills for context
4. **Check debug** - Use `debug: who are you?` to verify agent identity

### For Agents

1. **Stay in boundaries** - Defer to other agents for their domains
2. **Reference skills** - Link to skills instead of repeating patterns
3. **Update skills** - Propose updates when patterns evolve
4. **Collaborate** - Tag other agents when tasks span domains

### For Maintainers

1. **Keep skills DRY** - Don't duplicate information across skills
2. **Version control** - Track changes to understand evolution
3. **Review periodically** - Ensure skills reflect actual codebase
4. **Prune stale content** - Remove outdated patterns

---

## Debug Commands

Each agent responds to `debug: who are you?` with:
- Agent identity
- Current focus area
- Active task summary

Example:
```
User: debug: who are you?
Agent: I am the Frontend Agent. I implement browser extension UI using Vue.js, TypeScript, CSS, and Chrome APIs. Currently implementing the TagInput component.
```

---

## Contributing

When adding to `.claude/`:

1. Follow existing structure and templates
2. Use clear, descriptive names
3. Add cross-references to related files
4. Update this README if adding new categories
5. Update `SKILLS_ROADMAP.md` when completing planned skills

---

## Resources

- **Claude Code Docs**: https://github.com/anthropics/claude-code
- **Project CLAUDE.md**: `../CLAUDE.md` (user-facing design doc)
- **Skills Roadmap**: `SKILLS_ROADMAP.md` (planning document)

---

## Questions?

- Check `commands/agent-routing.md` for routing guidelines
- Review `SKILLS_ROADMAP.md` for planned skills
- Ask any agent: "How should I use the .claude/ system?"
