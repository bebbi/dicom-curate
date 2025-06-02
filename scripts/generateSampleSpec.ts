#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ——— Paths ———
const tsSourcePath = join(
  __dirname,
  '..',
  'src',
  'config',
  'sampleBatchCurationSpecification.ts',
)
const jsOutPath = join(
  __dirname,
  '..',
  'testdata',
  'sampleCurationSpecification.js',
)
const readmePath = join(__dirname, '..', 'README.md')

// ——— Read the TS source file ———
const tsSource = readFileSync(tsSourcePath, 'utf8').trim()

// ——— Prep snippet version: witch to dicom-curate import and drop comments ———
const snippetSource = tsSource.replace(
  /^import type \{ TCurationSpecification \} from ['"][^'"]+['"]\s*;?/m,
  "import type { TCurationSpecification } from 'dicom-curate'\n\n"
)

// ——— 1) Generate the JS module via transpilation ———
const jsOutput = ts.transpileModule(tsSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    removeComments: false,
    alwaysStrict: false,
  },
}).outputText

writeFileSync(jsOutPath, jsOutput, 'utf8')
console.log(`✅ Generated ${jsOutPath}`)

// ——— 2) Sync only the *annotated* README snippet ———
const readme = readFileSync(readmePath, 'utf8')
const relativeInput = relative(join(__dirname, '..'), tsSourcePath)
const MARKER = `<!-- Snippet auto-generated from ${relativeInput} -->`

// — extract the first array under "// File path"
const filePathRe = /^[ \t]*\/\/ File path\s*\r?\n[ \t]*(\[[\s\S]*?\]),?/m
const filePathMatch = snippetSource.match(filePathRe)
const filePathItem = filePathMatch ? filePathMatch[1].trim() : ''

// — extract the first array under "// DICOM header"
const dicomRe = /^[ \t]*\/\/ DICOM header\s*\r?\n[ \t]*(\[[\s\S]*?\]),?/m
const dicomMatch = snippetSource.match(dicomRe)
const dicomItem = dicomMatch ? dicomMatch[1].trim() : ''

// — capture the indent of the errors: line *and* match the entire existing block
const errorsRe = new RegExp(
  '^([ \\t]*)errors\\s*:\\s*\\[[ \\t]*\\r?\\n[\\s\\S]*?^\\1\\],?',
  'm',
)
const errorsMatch = snippetSource.match(errorsRe)
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

// — splice it into your snippet (fall back to original if any regex failed)
const shortenedContent = errorsMatch
  ? snippetSource.replace(errorsRe, newErrorsBlock)
  : snippetSource

// — wrap that full script in your README snippet, using TS fences
const replacement = `${MARKER}
\`\`\`ts
${shortenedContent}
\`\`\``

// — locate & replace the old fenced snippet
const escaped = MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fenceRe = new RegExp(escaped + '[\\s\\S]*?```ts[\\s\\S]*?```', 'm')

if (fenceRe.test(readme)) {
  const updated = readme.replace(fenceRe, replacement)
  writeFileSync(readmePath, updated, 'utf8')
  console.log(`✅ Updated code snippet in ${readmePath}`)
} else {
  console.warn(
    `⚠️ No README snippet marker found ("${MARKER}"), skipping update.`,
  )
}
