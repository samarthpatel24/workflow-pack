export const meta = {
  name: 'codebase-survey',
  description: 'Survey a codebase: map modules in parallel, then synthesize an architecture overview',
  phases: [
    { title: 'Scope', detail: 'list the top-level modules worth surveying' },
    { title: 'Map', detail: 'one agent per module, in parallel' },
    { title: 'Synthesize', detail: 'merge the summaries into one architecture overview' },
  ],
}

const root = typeof args === 'string' && args.trim() ? args.trim() : '.'

phase('Scope')
const MODULE_SCHEMA = {
  type: 'object',
  properties: {
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
  required: ['modules'],
}
const scope = await agent(
  `List the top-level source modules/directories worth surveying under "${root}". ` +
    `Ignore node_modules, build output, .git, and vendored dependencies. ` +
    `Return up to 12 of the most important ones, each with a one-line reason.`,
  { label: 'scope', schema: MODULE_SCHEMA },
)
const modules = (scope?.modules ?? []).slice(0, 12)
log(`Surveying ${modules.length} module(s) under ${root}`)

phase('Map')
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    purpose: { type: 'string' },
    keyFiles: { type: 'array', items: { type: 'string' } },
    publicApi: { type: 'array', items: { type: 'string' } },
    dependsOn: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'purpose'],
}
const summaries = await parallel(
  modules.map((m) => () =>
    agent(
      `Read the code under "${m.path}" and summarize it. ` +
        `Cover: its purpose, the key files, the public API it exposes, what it depends on, and any risks or smells. ` +
        `Be concise and concrete — name real files and symbols.`,
      { label: `map:${m.path}`, schema: SUMMARY_SCHEMA },
    ),
  ),
)
const mapped = summaries.filter(Boolean)

phase('Synthesize')
const overview = await agent(
  `Synthesize a single architecture overview from these module summaries. Produce:\n` +
    `1. A one-paragraph description of what the system is.\n` +
    `2. A module-by-module table (module | purpose | key dependencies).\n` +
    `3. The main data/control flow between modules.\n` +
    `4. The top 5 risks worth addressing.\n\n` +
    `Module summaries (JSON):\n${JSON.stringify(mapped, null, 2)}`,
  { label: 'synthesize' },
)

return { root, moduleCount: mapped.length, overview }
