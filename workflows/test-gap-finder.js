export const meta = {
  name: 'test-gap-finder',
  description: 'Find under-tested code in parallel and propose concrete missing test cases',
  phases: [
    { title: 'Inventory', detail: 'pair source modules with their tests' },
    { title: 'Analyze', detail: 'one agent per under-tested module' },
    { title: 'Plan', detail: 'a prioritized test plan' },
  ],
}

const root = typeof args === 'string' && args.trim() ? args.trim() : '.'

phase('Inventory')
const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          coverage: { type: 'string', enum: ['none', 'weak', 'partial'] },
          why: { type: 'string' },
        },
        required: ['module', 'coverage'],
      },
    },
  },
  required: ['gaps'],
}
const inventory = await agent(
  `Map the source modules under "${root}" against the existing test files. ` +
    `Identify the modules with no tests, weak tests, or only partial coverage. ` +
    `Return up to 12, worst coverage first, each with a one-line reason. Ignore generated and vendored code.`,
  { label: 'inventory', schema: INVENTORY_SCHEMA },
)
const gaps = (inventory?.gaps ?? []).slice(0, 12)
log(`Found ${gaps.length} under-tested module(s)`)

phase('Analyze')
const CASES_SCHEMA = {
  type: 'object',
  properties: {
    module: { type: 'string' },
    cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['happy-path', 'edge-case', 'error-path'] },
          description: { type: 'string' },
        },
        required: ['name', 'kind', 'description'],
      },
    },
  },
  required: ['module', 'cases'],
}
const analyzed = await parallel(
  gaps.map((g) => () =>
    agent(
      `Read "${g.module}" and propose the test cases it is missing. ` +
        `Cover happy paths, edge cases, and error paths. Be specific about inputs and expected behavior — ` +
        `enough that someone could write each test. Match the project's existing test framework.`,
      { label: `analyze:${g.module}`, schema: CASES_SCHEMA },
    ),
  ),
)
const modules = analyzed.filter(Boolean)

phase('Plan')
const plan = await agent(
  `Turn these proposed test cases into a prioritized test plan: order modules by risk and missing coverage, ` +
    `and for each list the test cases to add. Keep it actionable.\n\n` +
    `Proposed cases (JSON):\n${JSON.stringify(modules, null, 2)}`,
  { label: 'plan' },
)

return { root, moduleCount: modules.length, plan }
