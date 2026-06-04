export const meta = {
  name: 'release-notes',
  description: 'Turn recent commits/PRs into release notes: group by area, summarize in parallel, compile',
  phases: [
    { title: 'Collect', detail: 'gather changes and group them by area' },
    { title: 'Summarize', detail: 'one agent per area writes user-facing entries' },
    { title: 'Compile', detail: 'assemble the final release notes' },
  ],
}

const range =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : 'the commits since the most recent git tag (fall back to the last 20 commits)'

phase('Collect')
const AREAS_SCHEMA = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    areas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          changes: { type: 'array', items: { type: 'string' } },
        },
        required: ['area', 'changes'],
      },
    },
  },
  required: ['areas'],
}
const collected = await agent(
  `Using git, gather the changes in ${range}. Read the commit messages (and PR titles if available) and ` +
    `group them by product area or subsystem. Drop pure chores like formatting and lockfile bumps. ` +
    `If you can infer the new version/tag, include it.`,
  { label: 'collect', schema: AREAS_SCHEMA },
)
const areas = (collected?.areas ?? []).filter((a) => (a.changes?.length ?? 0) > 0)
log(`Summarizing ${areas.length} area(s) of changes`)

phase('Summarize')
const ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['added', 'changed', 'fixed', 'removed', 'security'] },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
  },
  required: ['area', 'entries'],
}
const summarized = await parallel(
  areas.map((a) => () =>
    agent(
      `Write user-facing release-note entries for the "${a.area}" changes below. ` +
        `Each entry is one line, written for users (not commit-speak), classified as added/changed/fixed/removed/security. ` +
        `Look at the diff if you need context.\n\nChanges:\n- ${a.changes.join('\n- ')}`,
      { label: `summarize:${a.area}`, schema: ENTRY_SCHEMA },
    ),
  ),
)
const sections = summarized.filter(Boolean)

phase('Compile')
const notes = await agent(
  `Compile these per-area entries into a single Keep-a-Changelog style release notes document, ` +
    `grouped by type (Added / Changed / Fixed / Removed / Security)${
      collected?.version ? ` for ${collected.version}` : ''
    }. Lead with a one-line summary of the release.\n\n` +
    `Entries (JSON):\n${JSON.stringify(sections, null, 2)}`,
  { label: 'compile' },
)

return { version: collected?.version ?? null, notes }
