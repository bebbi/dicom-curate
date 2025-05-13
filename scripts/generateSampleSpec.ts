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
  'sampleCurationSpecification.js',
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

// ——— 2) Sync only the *annotated* README snippet ———
const readme = readFileSync(readmePath, 'utf8')
const MARKER = `<!-- Snippet auto-generated from ${relativeInput} -->`

// — extract the first array under "// File path"
const filePathRe = /^[ \t]*\/\/ File path\s*\r?\n[ \t]*(\[[\s\S]*?\]),?/m
const filePathMatch = content.match(filePathRe)

if (!filePathMatch) {
  console.warn(
    `⚠️  No "// File path" comment found in ${inputPath}, retaining existing errors block`,
  )
}
const filePathItem = filePathMatch ? filePathMatch[1].trim() : ''

// — extract the first array under "// DICOM header"
const dicomRe = /^[ \t]*\/\/ DICOM header\s*\r?\n[ \t]*(\[[\s\S]*?\]),?/m
const dicomMatch = content.match(dicomRe)

if (filePathMatch && !dicomMatch) {
  console.warn(
    `⚠️  No "// DICOM header" comment found in ${inputPath}, retaining existing errors block`,
  )
}
const dicomItem = dicomMatch ? dicomMatch[1].trim() : ''

// — capture the indent of the `errors:` line *and* match the entire existing block
const errorsRe = new RegExp(
  '^([ \\t]*)errors\\s*:\\s*\\[[ \\t]*\\r?\\n[\\s\\S]*?^\\1\\],?',
  'm',
)
const errorsMatch = content.match(errorsRe)
if (filePathMatch && dicomMatch && !errorsMatch) {
  console.warn(
    `⚠️  No "errors: [...]" block found in ${inputPath}, skipping errors replacement`,
  )
}
const indent = errorsMatch ? errorsMatch[1] : '  '

// — build a new errors: [ … ] block
const newErrorsBlock = (
  filePathMatch && dicomMatch && errorsMatch
    ? [
        `${indent}errors: [`,
        `${indent}  // File path`,
        `${indent}  ${filePathItem},`,
        `${indent}  // DICOM header`,
        `${indent}  ${dicomItem},`,
        `${indent}],`,
      ]
    : [`${indent}],`]
).join('\n')

// — splice it into your script (fall back to original if any regex failed)
const shortenedContent = newErrorsBlock
  ? content.replace(errorsRe, newErrorsBlock)
  : content

// — wrap that full script in your README snippet
const replacement = `${MARKER}
\`\`\`js
${shortenedContent}
\`\`\``

// — locate & replace the old fenced snippet
const escaped = MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fenceRe = new RegExp(escaped + '[\\s\\S]*?```js[\\s\\S]*?```', 'm')

if (fenceRe.test(readme)) {
  const updated = readme.replace(fenceRe, replacement)
  writeFileSync(readmePath, updated, 'utf8')
  console.log(`✅ Updated code snippet in ${readmePath}`)
} else {
  console.log(
    `⚠️  No README snippet marker found ("${MARKER}"), skipping update.`,
  )
}
