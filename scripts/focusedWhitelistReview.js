#!/usr/bin/env node

/**
 * Focused analysis of DICOM whitelist attributes most likely to contain identifying information
 * This creates a prioritised review list for manual inspection
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import the whitelist
const whitelistPath = join(
  __dirname,
  '../src/config/dicom/elementNamesToAlwaysKeep.ts',
)
const whitelistContent = readFileSync(whitelistPath, 'utf8')

// Extract attribute names
const attributeMatches = whitelistContent.match(/'([^']+)'/g)
const attributes = attributeMatches.map((match) => match.slice(1, -1))

console.log(`🎯 FOCUSED WHITELIST REVIEW - Priority Attributes\n`)

// High-priority patterns that are most likely to contain identifying info
const highPriorityPatterns = [
  {
    name: 'Free Text Fields (Highest Risk)',
    pattern: /comment|description|text|string|note|remark|explanation/i,
    risk: 'CRITICAL',
    reason: 'Free text fields often contain identifying information',
  },
  {
    name: 'Institution & Personnel',
    pattern:
      /institution|hospital|clinic|department|station|operator|physician|doctor|reviewer|interpreter|technician/i,
    risk: 'HIGH',
    reason: 'Institutional and personnel information is identifying',
  },
  {
    name: 'Patient Context (Non-Medical)',
    pattern:
      /patient(?!.*(?:orientation|position|support|table|setup|coordinate|axis|plane|reference|geometry))/i,
    risk: 'HIGH',
    reason: 'Patient-related fields outside of geometric/positioning context',
  },
  {
    name: 'Specific Identifiers',
    pattern: /(?:^|[^a-z])(?:name|id)(?:$|[^a-z])/i,
    risk: 'HIGH',
    reason: 'Fields explicitly containing names or IDs',
  },
  {
    name: 'Contact & Communication',
    pattern: /phone|telephone|email|contact|communication|address/i,
    risk: 'HIGH',
    reason: 'Contact information is directly identifying',
  },
  {
    name: 'Protocol & Study Names',
    pattern: /protocol.*name|study.*name|series.*name|procedure.*name/i,
    risk: 'MEDIUM',
    reason: 'Named protocols/studies might contain identifying info',
  },
]

// Analyse and create prioritised review list
const reviewList = []

highPriorityPatterns.forEach(({ name, pattern, risk, reason }) => {
  const matches = attributes.filter((attr) => pattern.test(attr))

  if (matches.length > 0) {
    console.log(`\n🚨 ${risk}: ${name} (${matches.length} attributes)`)
    console.log(`   Reason: ${reason}\n`)

    matches.sort().forEach((attr) => {
      console.log(`   • ${attr}`)
      reviewList.push({
        attribute: attr,
        category: name,
        risk: risk,
        reason: reason,
      })
    })
  }
})

// Look for specific concerning patterns in attribute names
console.log(`\n\n🔍 SPECIFIC PATTERN ANALYSIS:\n`)

const specificPatterns = [
  {
    pattern: /creator|author|writer|operator/i,
    description: 'Attributes that might contain personnel names',
  },
  {
    pattern:
      /additional.*history|occupation|insurance|language|religion|ethnic/i,
    description: 'Demographic/personal information fields',
  },
  {
    pattern: /comment.*sequence|text.*sequence|description.*sequence/i,
    description: 'Sequence attributes containing free text',
  },
  {
    pattern: /manufacturer.*model|software.*version|device.*serial/i,
    description: 'Equipment identifiers that might be institution-specific',
  },
]

specificPatterns.forEach(({ pattern, description }) => {
  const matches = attributes.filter((attr) => pattern.test(attr))
  if (matches.length > 0) {
    console.log(`📋 ${description}:`)
    matches.sort().forEach((attr) => {
      console.log(`   • ${attr}`)
    })
    console.log()
  }
})

// Generate focused review CSV for manual inspection
console.log(`\n📝 GENERATING FOCUSED REVIEW LIST...\n`)

// Sort by risk level
const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
reviewList.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk])

// Remove duplicates (same attribute might match multiple patterns)
const uniqueReviewList = []
const seen = new Set()
reviewList.forEach((item) => {
  if (!seen.has(item.attribute)) {
    seen.add(item.attribute)
    uniqueReviewList.push(item)
  }
})

console.log(`Priority review list: ${uniqueReviewList.length} attributes`)
console.log(`\nTop 20 highest priority attributes for manual review:\n`)

uniqueReviewList.slice(0, 20).forEach((item, index) => {
  console.log(
    `${(index + 1).toString().padStart(2, ' ')}. [${item.risk}] ${item.attribute}`,
  )
  console.log(`    Category: ${item.category}`)
  console.log(`    Reason: ${item.reason}\n`)
})

if (uniqueReviewList.length > 20) {
  console.log(
    `... and ${uniqueReviewList.length - 20} more attributes to review`,
  )
}

// Save full list to file for detailed review
const csvContent = [
  'Attribute,Risk Level,Category,Reason',
  ...uniqueReviewList.map(
    (item) =>
      `"${item.attribute}","${item.risk}","${item.category}","${item.reason}"`,
  ),
].join('\n')

const csvPath = join(__dirname, '../whitelist_review_priority.csv')
writeFileSync(csvPath, csvContent)

console.log(`\n💾 Full priority list saved to: whitelist_review_priority.csv`)
console.log(`\n🎯 RECOMMENDED REVIEW PROCESS:`)
console.log(`1. Start with CRITICAL risk attributes (free text fields)`)
console.log(
  `2. Review HIGH risk attributes (institution, patient, contact info)`,
)
console.log(`3. For each attribute, check:`)
console.log(`   - DICOM standard definition`)
console.log(`   - Typical content examples`)
console.log(`   - Whether it could contain identifying information`)
console.log(`4. Create blacklist of confirmed problematic attributes`)
