import { readFileSync, writeFileSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const inputPath = join(
  __dirname,
  '..',
  'testdata',
  'sampleMappingSpecification.js',
)
const outputPath = join(
  __dirname,
  '..',
  'src',
  'config',
  'sampleSpecification.ts',
)

// Calculate a relative path for the comment (optional, but cleaner)
const relativeInputPath = relative(join(__dirname, '..', 'src'), inputPath)

const content = readFileSync(inputPath, 'utf8')

const output = `// Auto-generated file from ${relativeInputPath}
// Run \`yarn generate:sampleSpec\` to update

export const sampleSpecification = \`${content}\`;
`

// Write the module to disk
writeFileSync(outputPath, output)

console.log(`Generated ${outputPath}`)
