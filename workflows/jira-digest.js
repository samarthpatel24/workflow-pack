export const meta = {
  name: 'jira-digest',
  description: 'Pull Jira issues in scope, analyze each group in parallel, and produce a sprint/standup digest',
  phases: [
    { title: 'Pull', detail: 'fetch the issues and group them' },
    { title: 'Analyze', detail: 'one agent per group assesses status and risk' },
    { title: 'Digest', detail: 'a sprint digest with risks and next actions' },
  ],
}

const scope =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : 'the current/active sprint (use the default board if one is configured)'

phase('Pull')
const PULL_SCHEMA = {
  type: 'object',
  properties: {
    scope: { type: 'string' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                summary: { type: 'string' },
                status: { type: 'string' },
                assignee: { type: 'string' },
                updated: { type: 'string' },
              },
              required: ['key', 'summary', 'status'],
            },
          },
        },
        required: ['group', 'issues'],
      },
    },
  },
  required: ['groups'],
}
const pulled = await agent(
  `Fetch the Jira issues for ${scope}, using whatever Jira access is available in this session ` +
    `(a Jira MCP server, or the Jira REST API with configured credentials). If a specific JQL/board/sprint is ` +
    `given in the scope, use it. Group the issues by status (or by epic if that's more useful). ` +
    `Return key, summary, status, assignee, and last-updated for each.`,
  { label: 'pull', schema: PULL_SCHEMA },
)
const groups = (pulled?.groups ?? []).filter((g) => (g.issues?.length ?? 0) > 0)
log(`Analyzing ${groups.length} group(s) of Jira issues`)

phase('Analyze')
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    progress: { type: 'string' },
    blockers: { type: 'array', items: { type: 'string' } },
    stale: { type: 'array', items: { type: 'string' } },
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['group', 'progress', 'risk'],
}
const analyzed = await parallel(
  groups.map((g) => () =>
    agent(
      `Assess this group of Jira issues ("${g.group}"). Summarize progress, call out blockers and ` +
        `dependencies, flag stale issues (no recent update), and rate the overall risk. ` +
        `Pull extra detail from Jira if needed.\n\nIssues (JSON):\n${JSON.stringify(g.issues, null, 2)}`,
      { label: `analyze:${g.group}`, schema: ANALYSIS_SCHEMA },
    ),
  ),
)
const analyses = analyzed.filter(Boolean)

phase('Digest')
const digest = await agent(
  `Write a concise sprint/standup digest from these group analyses: an overall status line, what's on track, ` +
    `what's at risk (with the blockers), stale issues that need a nudge, and a short list of recommended next actions. ` +
    `Analyses (JSON):\n${JSON.stringify(analyses, null, 2)}`,
  { label: 'digest' },
)

return { scope, groupCount: analyses.length, digest }
