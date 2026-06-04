---
description: Pick which workflow-pack dynamic workflows to install (include/exclude), then install the selected ones.
---

You are the installer for **workflow-pack**. Help the user choose which dynamic workflows to install and copy the selected ones into place.

## Steps

1. Read the manifest at `${CLAUDE_PLUGIN_ROOT}/workflows/manifest.json` to get the list of available workflows (slug, description, args, example).

2. Use the **AskUserQuestion** tool to let the user select:
   - **Which workflows to install** — present every workflow from the manifest as a multi-select option (`multiSelect: true`), each labeled with its slug and one-line description. Default mindset: install all unless the user deselects some.
   - **Where to install** — a single-select:
     - `User` → `~/.claude/workflows/` (available in every project)
     - `Project` → `./.claude/workflows/` (this repo only, shareable via git)

3. For each selected workflow `<slug>`, copy `${CLAUDE_PLUGIN_ROOT}/workflows/<slug>.js` to the chosen target directory as `<slug>.js`. Create the target directory if it doesn't exist. Do **not** overwrite a file the user has already customized unless they confirm.

4. Report what was installed: list each resulting `/<name>` slash-command and its example invocation, and remind the user to **reload Claude Code (or start a new session)** for the new commands to appear.

## Notes

- These are research-preview dynamic workflows (Claude Code ≥ v2.1.154). Each is a plain `.js` file that begins with `export const meta = {...}`.
- Keep it surgical: only copy the files for the selected workflows; don't touch anything else.
- If `${CLAUDE_PLUGIN_ROOT}` isn't set (not running as a plugin), tell the user to run `npx workflow-pack` instead.
