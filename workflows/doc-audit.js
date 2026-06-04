export const meta = {
  name: 'doc-audit',
  description: 'Audit docs against the code in parallel to find stale, wrong, and missing documentation',
  phases: [
    { title: 'Inventory', detail: 'pair docs with the code they describe' },
    { title: 'Check', detail: 'one agent per doc area verifies accuracy' },
    { title: 'Report', detail: 'a prioritized list of doc fixes' },
  ],
}

const root = typeof args === 'string' && args.trim() ? args.trim() : '.'

phase('Inventory')
const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    areas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          doc: { type: 'string' },
          covers: { type: 'string' },
        },
        required: ['doc', 'covers'],
      },
    },
    undocumented: { type: 'array', items: { type: 'string' } },
  },
  required: ['areas'],
}
const inventory = await agent(
  `Under "${root}", find the documentation (README, docs/, guides, comments-as-docs) and match each doc to the ` +
    `code or feature it describes. Also list significant code areas that have no documentation at all. ` +
    `Return up to 12 doc areas.`,
  { label: 'inventory', schema: INVENTORY_SCHEMA },
)
const areas = (inventory?.areas ?? []).slice(0, 12)
log(`Checking ${areas.length} doc area(s)`)

phase('Check')
const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    doc: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['stale', 'wrong', 'missing', 'unclear'] },
          location: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['kind', 'detail'],
      },
    },
  },
  required: ['doc', 'issues'],
}
const checked = await parallel(
  areas.map((a) => () =>
    agent(
      `Verify the documentation "${a.doc}" against the actual code it covers (${a.covers}). ` +
        `Read both. Flag anything stale, factually wrong, missing, or unclear — with the exact location. ` +
        `Only report real mismatches.`,
      { label: `check:${a.doc}`, schema: CHECK_SCHEMA },
    ),
  ),
)
const results = checked.filter(Boolean)
const issueCount = results.reduce((n, r) => n + (r.issues?.length ?? 0), 0)

phase('Report')
const report = await agent(
  `Turn these documentation issues into a prioritized fix list (worst/most-misleading first), ` +
    `plus a short section on the undocumented areas that most need docs. ` +
    `Undocumented areas: ${JSON.stringify(inventory?.undocumented ?? [])}\n\n` +
    `Issues (JSON):\n${JSON.stringify(results, null, 2)}`,
  { label: 'report' },
)

return { root, issueCount, report }
