<p align="center">
  <img src="https://raw.githubusercontent.com/samarthpatel24/workflow-pack/master/assets/github-banner-workflow-pack.png" alt="workflow-pack" width="100%">
</p>

<p align="center">
  <em>Ten developer-focused Claude Code dynamic workflows. One install. Multi-agent runs, on tap.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/workflow-pack?style=for-the-badge&color=cb3837&label=npm" alt="npm version">
  <img src="https://img.shields.io/npm/dm/workflow-pack?style=for-the-badge&color=cb3837&label=downloads" alt="npm downloads">
  <img src="https://img.shields.io/badge/Claude%20Code-v2.1.154%2B-d97757?style=for-the-badge" alt="Claude Code">
  <img src="https://img.shields.io/badge/license-MIT-3b82f6?style=for-the-badge" alt="MIT license">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node >=18">
  <img src="https://img.shields.io/badge/JavaScript-ESM-f7df1e?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript ESM">
  <img src="https://img.shields.io/badge/zero-dependencies-22c55e?style=flat-square" alt="Zero dependencies">
  <img src="https://img.shields.io/badge/workflows-10-8957e5?style=flat-square" alt="10 workflows">
  <img src="https://img.shields.io/badge/marketplace-plugin-d97757?style=flat-square" alt="Marketplace plugin">
  <img src="https://img.shields.io/badge/provenance-signed-2dd4bf?style=flat-square" alt="Signed provenance">
</p>

---

A curated, `npx`-installable pack of **Claude Code dynamic workflows** — install one, run its
`/slash-command`, and get a multi-agent run that fans out and synthesizes a result.

> **Dynamic workflows** are a research-preview feature in Claude Code **v2.1.154+**. A workflow is a
> JavaScript orchestration script that the runtime executes in the background, spawning up to 16
> concurrent subagents. Saved workflows live in `~/.claude/workflows/` (user) or `.claude/workflows/`
> (project) and surface as `/slash-commands`. See the
> [docs](https://code.claude.com/docs/en/workflows).

## The workflows

| Command | What it does |
|---|---|
| `/codebase-survey [path]` | Map a codebase's modules in parallel → one architecture overview. |
| `/bug-sweep [path]` | Sweep code across 5 bug lenses in parallel, then adversarially verify each finding. |
| `/compare-options A vs B vs C` | One researcher per option, then a scored comparison table. |
| `/dependency-audit [path]` | Audit dependencies in parallel for outdated / deprecated / vulnerable packages. |
| `/test-gap-finder [path]` | Find under-tested code and propose concrete missing test cases. |
| `/release-notes [git range]` | Group recent commits by area, summarize in parallel, compile release notes. |
| `/doc-audit [path]` | Check docs against the code to find stale, wrong, and missing documentation. |
| `/api-surface-map [path]` | Discover endpoints, document each group in parallel, compile an API reference. |
| `/scaffold-feature <description>` | Plan a feature, generate each file in parallel, then review. |
| `/jira-digest [JQL]` | Pull Jira issues, analyze each group in parallel, produce a sprint/standup digest. |

Each one fans out into a multi-agent tree, so the run is genuinely parallel — and looks great when
recorded (see [Get reports](#get-reports-of-these-runs)).

## Install (npm)

Interactive — pick what you want with arrow keys + space:

```bash
npx workflow-pack            # opens the picker: select workflows, choose user/project scope
```

Or install directly without the picker:

```bash
npx workflow-pack list                 # see what's available
npx workflow-pack install bug-sweep    # install one
npx workflow-pack install --all        # install all of them
npx workflow-pack uninstall bug-sweep  # remove one
```

- Installs into `~/.claude/workflows/` by default. Add `--project` to install into
  `./.claude/workflows/` (shared via your repo).
- Idempotent and reversible: re-running `install` is safe; `uninstall` only removes a file it
  recognizes (use `--force` to overwrite or remove a file you've since edited).
- After installing, **reload Claude Code / start a new session** to pick up the new `/slash-commands`.

## Install (Claude Code marketplace plugin)

```text
/plugin marketplace add samarthpatel24/workflow-pack
/plugin install workflow-pack@workflow-pack
```

Then run the picker command inside Claude Code:

```text
/workflow-pack
```

It lists the workflows, lets you **include/exclude** the ones you want, asks for user or project
scope, and installs just those — the same selection experience as the npm `npx workflow-pack`
setup.

## Run one

```text
/bug-sweep src/api
/compare-options Postgres vs MySQL vs SQLite
/scaffold-feature add a /health endpoint returning JSON status
```

Claude Code asks to approve the workflow before it runs, then the run starts in the background.
Watch it with `/workflows`. Input is passed via the `args` global — pass a path, a git range, a
list, or a description as shown in the table.

## Get reports of these runs

Pair workflow-pack with **[`workflow-replay`](#)** (the Dynamic Workflow Trace Recorder) to turn any
of these runs into a shareable `report.html`:

1. Install the recorder's Stop hook (see its README).
2. Run a packed workflow, e.g. `/codebase-survey`.
3. Open the generated `report.html` — a rendered view of the multi-agent run.

The wiring is documentation-only: these workflows run fine on their own; the recorder is optional.

## Notes

- Research preview: the feature is pinned to Claude Code ≥ v2.1.154 and the saved-workflow format may
  change. The workflows are plain `.js` files (each begins with `export const meta = {...}`) — easy to
  read and edit.
- Workflows can route stages to different models and spawn up to 16 concurrent / 1,000 total agents
  per run. A run uses more tokens than a single conversation — try a narrow scope first.

## License

MIT
