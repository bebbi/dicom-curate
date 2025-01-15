// Node.js built-in modules
import { spawn } from 'child_process'
import { createReadStream } from 'fs'
import { writeFile, mkdir, readFile, access, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

// External dependencies
import axios from 'axios'
import bz2 from 'bz2'
import * as tar from 'tar-stream'
import { parseString } from 'xml2js'

const parseXmlString = promisify(parseString)

const XSLT_URL =
  'https://dicom.nema.org/medical/dicom/current/DocBookDICOM2024e_sourceandrenderingpipeline_20241115102423.tar.bz2'
const PART15_URL =
  'https://dicom.nema.org/medical/dicom/current/source/docbook/part15/part15.xml'
const TARGET_XSLT =
  'support/stylesheets/extractconfidentialityprofiledataelementsandhandling.xsl'

// Use system temp directory for intermediate files
const TEMP_DIR = path.join(os.tmpdir(), 'dcm-organize-' + Date.now())
const SCHEMA_DIR = 'schema'

// Python script for XSLT transformation
const PYTHON_XSLT_TRANSFORM = `
from lxml import etree
import sys

def transform_xml(xml_path, xslt_path, output_path):
    xml_doc = etree.parse(xml_path)
    xslt_doc = etree.parse(xslt_path)
    transform = etree.XSLT(xslt_doc)
    result = transform(xml_doc)
    with open(output_path, 'wb') as f:
        f.write(etree.tostring(result, pretty_print=True))

if __name__ == '__main__':
    xml_path = sys.argv[1]
    xslt_path = sys.argv[2]
    output_path = sys.argv[3]
    transform_xml(xml_path, xslt_path, output_path)
`

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(dir) {
  await mkdir(dir, { recursive: true })
}

async function downloadFile(url, outputPath) {
  if (await fileExists(outputPath)) {
    console.log(`File already exists at ${outputPath}, skipping download`)
    return outputPath
  }

  console.log(`Downloading to ${outputPath}...`)
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  await writeFile(outputPath, response.data)
  console.log(`Download completed`)
  return outputPath
}

async function decompressBz2(filePath, outputPath) {
  if (await fileExists(outputPath)) {
    console.log('Decompressed file already exists, skipping decompression')
    return outputPath
  }

  console.log('Decompressing bz2 file...')
  const compressedData = await readFile(filePath)
  const decompressedData = bz2.decompress(compressedData)
  await writeFile(outputPath, decompressedData)
  console.log('Decompression completed')
  return outputPath
}

async function extractTar(tarPath, outputPath) {
  if (await fileExists(outputPath)) {
    console.log('XSLT file already exists, skipping extraction')
    return await readFile(outputPath)
  }

  return new Promise((resolve, reject) => {
    const extract = tar.extract()
    let xsltContent = null

    extract.on('entry', (header, stream, callback) => {
      if (header.name === TARGET_XSLT) {
        console.log('Found XSLT file, extracting...')
        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => {
          xsltContent = Buffer.concat(chunks)
          callback()
        })
      } else {
        stream.resume() // skip this entry
        callback()
      }
    })

    extract.on('finish', async () => {
      if (xsltContent) {
        await writeFile(outputPath, xsltContent)
        resolve(xsltContent)
      } else {
        reject(new Error('XSLT file not found in archive'))
      }
    })

    extract.on('error', reject)

    createReadStream(tarPath).pipe(extract)
  })
}

async function transformXmlWithXslt(xmlPath, xsltPath, outputPath) {
  console.log('Starting XSLT transformation...')

  const scriptPath = path.join(TEMP_DIR, 'transform.py')
  await writeFile(scriptPath, PYTHON_XSLT_TRANSFORM)

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      scriptPath,
      xmlPath,
      xsltPath,
      outputPath,
    ])

    let errorOutput = ''

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    pythonProcess.on('close', async (code) => {
      if (code === 0) {
        const result = await readFile(outputPath, 'utf8')
        resolve(result)
      } else {
        reject(new Error(`Python process failed: ${errorOutput}`))
      }
    })
  })
}

async function convertXmlToJson(xmlString) {
  console.log('Converting XML to JSON...')

  const result = await parseXmlString(xmlString, {
    explicitArray: false,
    mergeAttrs: true,
    explicitRoot: false,
  })

  console.log('XML to JSON conversion completed')
  return result
}

async function cleanup() {
  try {
    await rm(TEMP_DIR, { recursive: true, force: true })
    console.log('Cleaned up temporary files')
  } catch (error) {
    console.warn(
      'Warning: Could not clean up some temporary files:',
      error.message,
    )
  }
}

async function cleanupSchemaDirectory() {
  const schemaPath = path.join(process.cwd(), SCHEMA_DIR)
  try {
    await rm(schemaPath, { recursive: true, force: true })
    console.log('Cleaned up existing schema directory')
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }
}

async function ensureSchemaDirectory() {
  const schemaPath = path.join(process.cwd(), SCHEMA_DIR)
  await mkdir(schemaPath, { recursive: true })
  return schemaPath
}

async function main() {
  try {
    // Clean up old schema directory if it exists
    await cleanupSchemaDirectory()

    // Ensure schema directory exists
    const schemaPath = await ensureSchemaDirectory()

    await ensureDirectory(TEMP_DIR)

    // Download and process files in temp directory
    const part15Path = path.join(TEMP_DIR, 'part15.xml')
    const bz2Path = path.join(TEMP_DIR, 'source.tar.bz2')
    const tarPath = path.join(TEMP_DIR, 'decompressed.tar')
    const xsltPath = path.join(TEMP_DIR, 'transform.xsl')
    const transformedPath = path.join(TEMP_DIR, 'transformed.xml')

    // Download files
    await downloadFile(PART15_URL, part15Path)
    await downloadFile(XSLT_URL, bz2Path)

    // Process files
    await decompressBz2(bz2Path, tarPath)
    await extractTar(tarPath, xsltPath)
    const transformedXml = await transformXmlWithXslt(
      part15Path,
      xsltPath,
      transformedPath,
    )

    // Convert to JSON
    const jsonResult = await convertXmlToJson(transformedXml)

    // Save the JSON output to the schema directory
    const jsonPath = path.join(schemaPath, 'annex_e_table.json')
    await writeFile(jsonPath, JSON.stringify(jsonResult, null, 2))
    console.log(
      `Successfully generated ${path.relative(process.cwd(), jsonPath)}`,
    )
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  } finally {
    // Clean up temporary files
    await cleanup()
  }
}

// Handle cleanup on script termination
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

main()
