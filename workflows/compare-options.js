export const meta = {
  name: 'compare-options',
  description: 'Compare options head-to-head: one researcher per option, then a scored comparison table',
  phases: [
    { title: 'Research', detail: 'one agent researches each option in parallel' },
    { title: 'Judge', detail: 'an impartial judge scores and ranks them' },
  ],
}

const options = Array.isArray(args)
  ? args.map(String)
  : typeof args === 'string'
    ? args.split(/\s*(?:,|\bvs\.?\b|\bversus\b)\s*/i).map((s) => s.trim()).filter(Boolean)
    : []

if (options.length < 2) {
  return {
    error:
      'Need at least 2 options. Pass them as args, e.g. /compare-options ["Postgres","MySQL","SQLite"] ' +
      'or /compare-options Postgres vs MySQL vs SQLite',
  }
}

phase('Research')
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    option: { type: 'string' },
    summary: { type: 'string' },
    pros: { type: 'array', items: { type: 'string' } },
    cons: { type: 'array', items: { type: 'string' } },
    bestFor: { type: 'string' },
  },
  required: ['option', 'summary', 'pros', 'cons'],
}
const research = await parallel(
  options.map((opt) => () =>
    agent(
      `Research the option "${opt}" for this comparison: ${options.join(' vs ')}. ` +
        `Give a short summary, concrete pros, concrete cons, and what it is best for. ` +
        `Use web search if it helps and is available. Stay objective — don't favour any option.`,
      { label: `research:${opt}`, schema: FINDINGS_SCHEMA },
    ),
  ),
)
const findings = research.filter(Boolean)

phase('Judge')
const verdict = await agent(
  `You are an impartial judge comparing these options: ${options.join(', ')}. ` +
    `Using the per-option research below, produce:\n` +
    `1. A markdown comparison table scoring each option (1-5) on the dimensions that matter for this decision.\n` +
    `2. A clear recommendation, naming the trade-off you are making.\n` +
    `3. When you would pick each runner-up instead.\n\n` +
    `Research (JSON):\n${JSON.stringify(findings, null, 2)}`,
  { label: 'judge' },
)

return { options, verdict }
