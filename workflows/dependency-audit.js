export const meta = {
  name: 'dependency-audit',
  description: 'Audit project dependencies in parallel for outdated, deprecated, and vulnerable packages',
  phases: [
    { title: 'Scan', detail: 'find manifests and group the dependencies' },
    { title: 'Assess', detail: 'one agent per dependency group' },
    { title: 'Report', detail: 'a prioritized upgrade plan' },
  ],
}

const root = typeof args === 'string' && args.trim() ? args.trim() : '.'

phase('Scan')
const GROUPS_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ecosystem: { type: 'string' },
          manifest: { type: 'string' },
          packages: { type: 'array', items: { type: 'string' } },
        },
        required: ['ecosystem', 'packages'],
      },
    },
  },
  required: ['groups'],
}
const scan = await agent(
  `Find every dependency manifest under "${root}" (package.json, requirements.txt, pyproject.toml, ` +
    `go.mod, Cargo.toml, pom.xml, Gemfile, etc). Extract the declared dependencies and group them by ` +
    `ecosystem and manifest. Skip lockfiles and node_modules.`,
  { label: 'scan', schema: GROUPS_SCHEMA },
)
const groups = (scan?.groups ?? []).filter((g) => (g.packages?.length ?? 0) > 0)
log(`Auditing ${groups.length} dependency group(s)`)

phase('Assess')
const ASSESS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          package: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'outdated', 'deprecated', 'vulnerable'] },
          detail: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['package', 'status'],
      },
    },
  },
  required: ['findings'],
}
const assessed = await parallel(
  groups.map((g) => () =>
    agent(
      `Assess these ${g.ecosystem} dependencies for problems: outdated versions, deprecation, and known ` +
        `vulnerabilities. Use web search if available to check current versions and advisories. ` +
        `Only flag real concerns.\n\nPackages: ${g.packages.join(', ')}`,
      { label: `assess:${g.ecosystem}`, schema: ASSESS_SCHEMA },
    ),
  ),
)
const findings = assessed.filter(Boolean).flatMap((a) => a.findings ?? [])

phase('Report')
const report = await agent(
  `Turn these dependency findings into a prioritized upgrade plan: a markdown table grouped by urgency ` +
    `(security first, then deprecated, then outdated), with the recommended action for each. ` +
    `Note anything that is a breaking-change upgrade.\n\nFindings (JSON):\n${JSON.stringify(findings, null, 2)}`,
  { label: 'report' },
)

return { root, flagged: findings.filter((f) => f.status !== 'ok').length, report }
