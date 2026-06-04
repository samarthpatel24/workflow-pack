export const meta = {
  name: 'bug-sweep',
  description: 'Sweep code for bugs across multiple lenses in parallel, then adversarially verify each finding',
  phases: [
    { title: 'Find', detail: 'parallel finders, one bug lens each' },
    { title: 'Verify', detail: 'a skeptic tries to refute each finding' },
  ],
}

const target =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : 'the recently changed code (git diff); fall back to the whole project if there is no diff'

const LENSES = [
  { key: 'logic', focus: 'logic errors, off-by-one, wrong conditions, incorrect control flow' },
  { key: 'error-handling', focus: 'swallowed errors, missing propagation, bad fallbacks, unhandled rejections' },
  { key: 'security', focus: 'injection, unsafe input handling, leaked secrets, authz/authn gaps, SSRF' },
  { key: 'concurrency', focus: 'race conditions, unsynchronized shared state, async/await misuse' },
  { key: 'edge-cases', focus: 'null/undefined, empty collections, boundary values, resource leaks' },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          detail: { type: 'string' },
        },
        required: ['title', 'file', 'detail'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    reasoning: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['isReal', 'reasoning'],
}

phase('Find')
const results = await pipeline(
  LENSES,
  (lens) =>
    agent(
      `Review ${target} for bugs through ONE lens only: ${lens.focus}. ` +
        `Report only concrete, real issues, each with a file and line. Do not speculate or nitpick style.`,
      { label: `find:${lens.key}`, phase: 'Find', schema: FINDINGS_SCHEMA },
    ),
  (review, lens) =>
    parallel(
      (review?.findings ?? []).map((f) => () =>
        agent(
          `Adversarially verify this suspected bug. Try to REFUTE it. ` +
            `Read the actual code at ${f.file}:${f.line ?? '?'} before deciding. ` +
            `If it is not clearly a real bug, set isReal=false.\n\n` +
            `Claim: ${f.title}\nDetail: ${f.detail}`,
          { label: `verify:${f.file}`, phase: 'Verify', schema: VERDICT_SCHEMA },
        ).then((v) => ({ ...f, lens: lens.key, verdict: v })),
      ),
    ),
)

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const confirmed = results
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict?.isReal)
  .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))

return { target, confirmedCount: confirmed.length, confirmed }
