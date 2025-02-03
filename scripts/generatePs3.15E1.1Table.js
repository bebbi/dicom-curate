import { writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const srcDir = join(__dirname, '..', 'src')
const configDir = join(srcDir, 'config', 'dicom')

/**
 * Fetches a DICOM standard file from the innolitics/dicom-standard repository.
 *
 * @param {string} filename - The name of the file to fetch.
 * @returns {Promise<object>} A promise resolving to the JSON contents of the file.
 */
async function fetchDicomStandard(filename) {
  const url = `https://raw.githubusercontent.com/innolitics/dicom-standard/master/standard/${filename}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Generates the DICOM elements profile.
 */
async function main() {
  try {
    // Ensure the configuration directory exists
    await mkdir(configDir, { recursive: true })

    // Fetch the DICOM elements to anonymize
    const ps315EElements = await fetchDicomStandard(
      'confidentiality_profile_attributes.json',
    )
    const protectSet = new Set(ps315EElements.map((element) => element.tag))

    // Save the elements to anonymize to a JSON file
    await writeFile(
      join(configDir, 'ps315EElements.ts'),
      `import type { TPs315EElement } from '../../types'

export const ps315EElements: TPs315EElement[] = ` +
        JSON.stringify(ps315EElements, null, 2),
    )

    // Fetch all DICOM elements
    const allElements = await fetchDicomStandard('attributes.json')
    const preserveSet = new Set()

    // Create a set of elements to preserve (using keywords)
    for (const element of allElements) {
      if (!protectSet.has(element.tag) && element.keyword) {
        preserveSet.add(element.keyword)
      }
    }

    // Create the JavaScript content for the element names to always keep
    const tsContent = `// Auto-generated file containing DICOM elements to always keep
// Generated on: ${new Date().toISOString()}

export const elementNamesToAlwaysKeep = [
    ${[...preserveSet].map((e) => `'${e}'`).join(',\n    ')}
];
`

    // Write the JavaScript file
    await writeFile(join(configDir, 'elementNamesToAlwaysKeep.ts'), tsContent)

    console.log('Successfully generated:')
    console.log('- elementNamesToAlwaysKeep.ts')
    console.log('- ps315EElements.ts')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
