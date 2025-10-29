#!/usr/bin/env node

/**
 * Extract CRITICAL and HIGH risk attributes from CSV for blacklist array
 * Usage: node scripts/extractHighRiskAttributes.js
 * NOTE: these should still be manually reviewed before adding to the blacklist
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const csvPath = join(__dirname, '../whitelist_review_priority.csv')

try {
  const csvContent = readFileSync(csvPath, 'utf8')
  const lines = csvContent.split('\n').slice(1) // Skip header

  const highRiskAttributes = []

  lines.forEach((line) => {
    if (line.trim()) {
      const [attribute, riskLevel] = line
        .split(',')
        .map((field) => field.replace(/"/g, '').trim())

      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        highRiskAttributes.push(attribute)
      }
    }
  })

  console.log(
    `// ${highRiskAttributes.length} CRITICAL and HIGH risk attributes extracted from CSV`,
  )
  console.log('export const manualBlacklist: string[] = [')

  highRiskAttributes.forEach((attr, index) => {
    const comma = index < highRiskAttributes.length - 1 ? ',' : ''
    console.log(`  '${attr}'${comma}`)
  })

  console.log(']')

  console.log(`\n// Generated ${new Date().toISOString()}`)
  console.log(`// Total attributes: ${highRiskAttributes.length}`)
} catch (error) {
  console.error('Error reading CSV file. Make sure to run:')
  console.error('node scripts/focusedWhitelistReview.js')
  console.error('\nError:', error.message)
}
