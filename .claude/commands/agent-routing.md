---
description: Route tasks to specialized agents
---

This project has specialized agents for different concerns. Route your request appropriately:

## Available Agents

### UX Agent (`ux-agent`)
**Use when:**
- Designing user interaction patterns
- Evaluating usability and accessibility
- Proposing UI/UX improvements
- Creating wireframes or interaction flows
- Discussing visual hierarchy and information architecture

**Example prompts:**
- "Review the side panel layout for usability issues"
- "Design the autocomplete interaction for the chat box"
- "How should we indicate unsaved changes?"

---

### Frontend Agent (`frontend-agent`)
**Use when:**
- Implementing Vue components
- Working with Chrome Extension APIs
- Writing TypeScript for UI logic
- Styling components with CSS
- Debugging extension contexts

**Example prompts:**
- "Implement the TagInput component"
- "Fix the message passing between side panel and background"
- "Add keyboard shortcuts to the chat interface"

---

### Data Agent (`data-agent`)
**Use when:**
- Designing database schema
- Implementing search algorithms
- Optimizing queries and indexes
- Planning data migrations
- Designing import/export formats

**Example prompts:**
- "Add a new field to track page access frequency"
- "Optimize the fuzzy search ranking algorithm"
- "Design the unused pages detection logic"

---

### CC Artifact Agent (`CC-artifact-agent`)
**Use when:**
- Creating or updating agent definitions
- Maintaining skills and commands
- Updating CLAUDE.md
- Managing `.claude/` directory structure

**Example prompts:**
- "Create a new agent for testing"
- "Add a skill for API integration patterns"
- "Update CLAUDE.md with new architecture"

---

## Routing Guidelines

1. **UX first, then Frontend**: Design the interaction before implementing it
2. **Data informs UX**: Consult Data Agent about search capabilities before designing search UX
3. **Frontend implements both**: Frontend Agent implements what UX designs and uses what Data provides
4. **Cross-agent collaboration**: Tag multiple agents when needed (e.g., "UX + Data: Design the search results presentation")

## Special Cases

- **New features**: Start with UX Agent for design, then Data Agent for schema, then Frontend Agent for implementation
- **Bug fixes**: Route to the appropriate agent (UX for interaction bugs, Frontend for implementation bugs, Data for query bugs)
- **Refactoring**: Usually Frontend or Data Agent, unless it's architectural (then multiple agents)

## Debugging Agent Identity

To check which agent you're talking to:

```
debug: who are you?
```

Each agent will identify itself and its current focus.
