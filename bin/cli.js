#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin, stdout } from 'node:process'
import readline from 'node:readline'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKFLOWS_DIR = join(HERE, '..', 'workflows')

function manifest() {
  return JSON.parse(readFileSync(join(WORKFLOWS_DIR, 'manifest.json'), 'utf8')).workflows
}

function targetDir(project) {
  return join(project ? process.cwd() : homedir(), '.claude', 'workflows')
}

function sourcePath(slug) {
  return join(WORKFLOWS_DIR, `${slug}.js`)
}

function find(slug) {
  return manifest().find((w) => w.slug === slug)
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

function isInteractive() {
  return Boolean(stdin.isTTY && stdout.isTTY)
}

// ---------- core install/uninstall ----------

function installOne(slug, dir, force) {
  const wf = find(slug)
  if (!wf) {
    console.error(`  ✗ unknown workflow "${slug}" (run "workflow-pack list")`)
    return false
  }
  const src = readFileSync(sourcePath(slug), 'utf8')
  const dest = join(dir, `${slug}.js`)
  const existing = read(dest)

  if (existing !== null && existing !== src && !force) {
    console.error(`  ✗ ${slug}: a different /${wf.name} already exists — use --force to overwrite`)
    return false
  }
  if (existing === src) {
    console.log(`  = ${slug}: already installed → /${wf.name}`)
    return true
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(dest, src)
  console.log(`  ✓ ${slug}: installed → /${wf.name}`)
  return true
}

function installList(slugs, dir, force) {
  console.log(`\nInstalling into ${dir}\n`)
  let ok = true
  for (const s of slugs) ok = installOne(s, dir, force) && ok
  console.log(`\nReload Claude Code (or start a new session) to pick up the new /slash-commands.\n`)
  return ok
}

// ---------- non-interactive commands ----------

function cmdList() {
  const wfs = manifest()
  console.log(`\nworkflow-pack — ${wfs.length} dynamic workflows for Claude Code\n`)
  for (const w of wfs) {
    console.log(`  ${w.slug}`)
    console.log(`    ${w.description}`)
    console.log(`    args:    ${w.args}`)
    console.log(`    example: ${w.example}\n`)
  }
  console.log('Interactive:   npx workflow-pack            (pick what to install)')
  console.log('Direct:        npx workflow-pack install <name>   (or --all)')
  console.log('Add --project to target ./.claude/workflows instead of your home dir.\n')
}

function cmdInstall(names, project, all, force) {
  const slugs = all ? manifest().map((w) => w.slug) : names
  if (slugs.length === 0) {
    console.error('Nothing to install. Pass a workflow name or --all (see "workflow-pack list").')
    process.exit(1)
  }
  if (!installList(slugs, targetDir(project), force)) process.exit(1)
}

function cmdUninstall(names, project, all, force) {
  const dir = targetDir(project)
  const slugs = all ? manifest().map((w) => w.slug) : names
  if (slugs.length === 0) {
    console.error('Nothing to uninstall. Pass a workflow name or --all.')
    process.exit(1)
  }
  console.log(`\nUninstalling from ${dir}\n`)
  for (const slug of slugs) {
    const dest = join(dir, `${slug}.js`)
    const existing = read(dest)
    if (existing === null) {
      console.log(`  = ${slug}: not installed`)
      continue
    }
    const packaged = read(sourcePath(slug))
    if (packaged !== null && existing !== packaged && !force) {
      console.error(`  ✗ ${slug}: file was modified — use --force to remove it`)
      continue
    }
    rmSync(dest)
    console.log(`  ✓ ${slug}: removed`)
  }
  console.log()
}

// ---------- interactive prompts (no dependencies) ----------

function keyLoop(render, onKey) {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(stdin)
    if (stdin.isTTY) stdin.setRawMode(true)
    stdout.write('\x1b[?25l') // hide cursor
    let lines = 0
    const draw = () => {
      const out = render()
      if (lines) stdout.write(`\x1b[${lines}A`)
      stdout.write('\x1b[0J')
      stdout.write(out)
      lines = out.split('\n').length - 1
    }
    const cleanup = () => {
      stdout.write('\x1b[?25h')
      if (stdin.isTTY) stdin.setRawMode(false)
      stdin.removeListener('keypress', handler)
      stdin.pause()
    }
    const handler = (str, key) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        cleanup()
        stdout.write('\nCancelled.\n')
        process.exit(130)
      }
      const done = onKey(key, draw)
      if (done !== undefined) {
        cleanup()
        resolve(done)
      }
    }
    stdin.on('keypress', handler)
    stdin.resume()
    draw()
  })
}

function checkbox(title, items) {
  const checked = items.map(() => true)
  let cursor = 0
  const render = () => {
    let out = `${title}\n`
    out += '  ↑/↓ move · space toggle · a all · n none · enter confirm\n\n'
    items.forEach((it, i) => {
      const box = checked[i] ? '◉' : '◯'
      const pointer = i === cursor ? '❯' : ' '
      const label = i === cursor ? `\x1b[36m${it.slug}\x1b[0m` : it.slug
      out += `${pointer} ${box} ${label}  —  ${it.description}\n`
    })
    out += '\n'
    return out
  }
  return keyLoop(render, (key, draw) => {
    switch (key.name) {
      case 'up':
        cursor = (cursor - 1 + items.length) % items.length
        draw()
        break
      case 'down':
        cursor = (cursor + 1) % items.length
        draw()
        break
      case 'space':
        checked[cursor] = !checked[cursor]
        draw()
        break
      case 'a':
        checked.fill(true)
        draw()
        break
      case 'n':
        checked.fill(false)
        draw()
        break
      case 'return':
        return items.filter((_, i) => checked[i])
    }
  })
}

function select(title, choices) {
  let cursor = 0
  const render = () => {
    let out = `${title}\n  ↑/↓ move · enter select\n\n`
    choices.forEach((c, i) => {
      const pointer = i === cursor ? '❯' : ' '
      const label = i === cursor ? `\x1b[36m${c.label}\x1b[0m` : c.label
      out += `${pointer} ${label}\n`
    })
    out += '\n'
    return out
  }
  return keyLoop(render, (key, draw) => {
    switch (key.name) {
      case 'up':
        cursor = (cursor - 1 + choices.length) % choices.length
        draw()
        break
      case 'down':
        cursor = (cursor + 1) % choices.length
        draw()
        break
      case 'return':
        return choices[cursor].value
    }
  })
}

async function cmdSetup() {
  if (!isInteractive()) {
    console.log('This shell is not interactive. Install directly instead:')
    console.log('  npx workflow-pack install --all        # everything')
    console.log('  npx workflow-pack install <name> ...   # a subset\n')
    cmdList()
    return
  }
  console.log('\nworkflow-pack setup\n')
  const selected = await checkbox('Select the workflows to install:', manifest())
  if (selected.length === 0) {
    console.log('\nNothing selected — nothing installed.\n')
    return
  }
  const project = await select('Install where?', [
    { label: 'User    — ~/.claude/workflows  (available in every project)', value: false },
    { label: 'Project — ./.claude/workflows  (this repo only, shareable)', value: true },
  ])
  installList(
    selected.map((w) => w.slug),
    targetDir(project),
    false,
  )
}

// ---------- entry ----------

function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const positional = argv.filter((a) => !a.startsWith('--'))
  const [cmd, ...names] = positional
  const project = flags.has('--project')
  const all = flags.has('--all')
  const force = flags.has('--force')

  switch (cmd) {
    case undefined:
    case 'setup':
      cmdSetup()
      break
    case 'list':
      cmdList()
      break
    case 'install':
      cmdInstall(names, project, all, force)
      break
    case 'uninstall':
    case 'remove':
      cmdUninstall(names, project, all, force)
      break
    default:
      console.error(`Unknown command "${cmd}". Use: setup | list | install | uninstall  [--all] [--project] [--force]`)
      process.exit(1)
  }
}

main()
