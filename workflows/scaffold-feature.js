export const meta = {
  name: 'scaffold-feature',
  description: 'Generate a feature: plan the change, write each file in parallel following conventions, then review',
  phases: [
    { title: 'Plan', detail: 'design the change against the codebase conventions' },
    { title: 'Generate', detail: 'one agent writes each file in parallel' },
    { title: 'Review', detail: 'a reviewer checks consistency and lists follow-ups' },
  ],
}

const feature = typeof args === 'string' && args.trim() ? args.trim() : ''
if (!feature) {
  return { error: 'Describe the feature to scaffold, e.g. /scaffold-feature add a /health endpoint with a JSON status payload' }
}

phase('Plan')
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    conventions: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'modify'] },
          spec: { type: 'string' },
        },
        required: ['path', 'action', 'spec'],
      },
    },
  },
  required: ['summary', 'files'],
}
const plan = await agent(
  `Plan the implementation of this feature in the current codebase: "${feature}". ` +
    `First study the project's conventions (language, framework, structure, naming, test style). ` +
    `Then produce a concrete file-by-file plan: for each file, whether to create or modify it and exactly what it should contain. ` +
    `Include tests. Do not write code yet.`,
  { label: 'plan', schema: PLAN_SCHEMA },
)
const files = (plan?.files ?? []).slice(0, 16)
log(`Generating ${files.length} file(s) for: ${feature}`)

phase('Generate')
const GEN_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    done: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['path', 'done'],
}
const generated = await parallel(
  files.map((f) => () =>
    agent(
      `Implement this part of the feature "${feature}". ${f.action === 'create' ? 'Create' : 'Modify'} the file ` +
        `"${f.path}" so that: ${f.spec}\n\n` +
        `Match the project's existing conventions exactly: ${plan?.conventions ?? 'follow nearby code'}. ` +
        `Write the actual file. Keep the change surgical and self-consistent with the plan summary: ${plan?.summary}`,
      { label: `generate:${f.path}`, schema: GEN_SCHEMA },
    ),
  ),
)
const written = generated.filter(Boolean)

phase('Review')
const review = await agent(
  `Review the feature that was just scaffolded: "${feature}". ` +
    `Read the files that were created/modified (${files.map((f) => f.path).join(', ')}). ` +
    `Check they are consistent with each other and the codebase, wire together correctly, and have no obvious bugs. ` +
    `Report what's solid, what needs a fix, and the follow-up steps (e.g. run tests, install deps).`,
  { label: 'review' },
)

return { feature, filesWritten: written.length, plan: plan?.summary, review }
