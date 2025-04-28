#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ——— Paths ———
const inputPath = join(
  __dirname,
  '..',
  'testdata',
  'sampleMappingSpecification.js',
)
const outputTsPath = join(
  __dirname,
  '..',
  'src',
  'config',
  'sampleSpecification.ts',
)
const readmePath = join(__dirname, '..', 'README.md')

// ——— Read the source file ———
const content = readFileSync(inputPath, 'utf8').trim()

// ——— 1) Generate the TS module ———
const relativeInput = relative(join(__dirname, '..', 'src'), inputPath)
const tsModule = `// Auto-generated from ${relativeInput}
// Run \`yarn generate:sampleSpec\` to update

export const sampleSpecification = \`${content}\`
`

writeFileSync(outputTsPath, tsModule, 'utf8')
console.log(`✅ Generated ${outputTsPath}`)

// ——— 2) Sync only the *annotated* README code block ———
// In your README.md, put this *immediately above* the ```js fence you want replaced:
//    <!-- snippet: sampleMappingSpecification -->

const MARKER = `<!-- Snippet auto-generated from ${relativeInput} -->`
const readme = readFileSync(readmePath, 'utf8')

// Build a regex that looks for our marker, then the very next ```js…``` block
const escapedMarker = MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fenceRe = new RegExp(escapedMarker + '\\s*\\n```js[\\s\\S]*?```', 'm')

if (fenceRe.test(readme)) {
  const replacement = MARKER + '\n' + '```js\n' + content + '\n' + '```'

  const updated = readme.replace(fenceRe, replacement)
  writeFileSync(readmePath, updated, 'utf8')
  console.log(`✅ Updated code snippet in ${readmePath}`)
} else {
  console.log(
    `⚠️  No README snippet marker found ("${MARKER}"), skipping README update.`,
  )
}
