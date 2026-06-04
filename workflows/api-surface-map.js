export const meta = {
  name: 'api-surface-map',
  description: 'Map a project\'s API surface: discover endpoints, document each group in parallel, compile a reference',
  phases: [
    { title: 'Discover', detail: 'find endpoint definitions and group them' },
    { title: 'Document', detail: 'one agent per route group' },
    { title: 'Compile', detail: 'a single API reference + gaps' },
  ],
}

const root = typeof args === 'string' && args.trim() ? args.trim() : '.'

phase('Discover')
const GROUPS_SCHEMA = {
  type: 'object',
  properties: {
    style: { type: 'string' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          location: { type: 'string' },
        },
        required: ['group', 'location'],
      },
    },
  },
  required: ['groups'],
}
const discover = await agent(
  `Under "${root}", find where the API surface is defined — HTTP routes, RPC handlers, GraphQL resolvers, ` +
    `or CLI commands, whichever this project uses. Group the endpoints by router/module/resource and note ` +
    `where each group lives. Identify the overall API style.`,
  { label: 'discover', schema: GROUPS_SCHEMA },
)
const groups = (discover?.groups ?? []).slice(0, 14)
log(`Documenting ${groups.length} endpoint group(s) (${discover?.style ?? 'unknown style'})`)

phase('Document')
const DOC_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    endpoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          method: { type: 'string' },
          path: { type: 'string' },
          purpose: { type: 'string' },
          params: { type: 'array', items: { type: 'string' } },
          auth: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['path', 'purpose'],
      },
    },
  },
  required: ['group', 'endpoints'],
}
const documented = await parallel(
  groups.map((g) => () =>
    agent(
      `Document the API endpoints in the "${g.group}" group (defined around ${g.location}). ` +
        `For each: method, path, purpose, key params, auth requirements, and any gotchas. Read the code.`,
      { label: `document:${g.group}`, schema: DOC_SCHEMA },
    ),
  ),
)
const docs = documented.filter(Boolean)
const endpointCount = docs.reduce((n, d) => n + (d.endpoints?.length ?? 0), 0)

phase('Compile')
const reference = await agent(
  `Compile these endpoint groups into a single API reference: a grouped markdown table of all endpoints, ` +
    `followed by a short "gaps & risks" section (inconsistent patterns, missing auth, undocumented behavior). ` +
    `Endpoints (JSON):\n${JSON.stringify(docs, null, 2)}`,
  { label: 'compile' },
)

return { root, endpointCount, reference }
