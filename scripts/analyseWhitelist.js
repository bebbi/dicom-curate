#!/usr/bin/env node

/**
 * Script to analyse the DICOM whitelist for potentially problematic attributes
 * that might contain identifying information despite not being in PS3.15E1.1
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load dcmjs to get DICOM dictionary information
let nameMap
try {
  const dcmjs = await import('dcmjs')
  nameMap = dcmjs.data.DicomMetaDictionary.nameMap
} catch {
  console.warn('⚠️  dcmjs not available, VR filtering will be skipped')
  nameMap = null
}

// Import the whitelist
const whitelistPath = join(
  __dirname,
  '../src/config/dicom/elementNamesToAlwaysKeep.ts',
)
const whitelistContent = readFileSync(whitelistPath, 'utf8')

// Extract attribute names from the TypeScript array
const attributeMatches = whitelistContent.match(/'([^']+)'/g)
if (!attributeMatches) {
  console.error('Could not parse whitelist file')
  process.exit(1)
}

const allAttributes = attributeMatches.map((match) => match.slice(1, -1)) // Remove quotes

// Filter out UIDs upfront (VR type 'UI')
const attributes = allAttributes.filter((attr) => {
  if (!nameMap || !nameMap[attr]) {
    return true // Keep if we can't determine VR type
  }
  return nameMap[attr].vr !== 'UI' // Exclude UIDs
})

const filteredCount = allAttributes.length - attributes.length
if (filteredCount > 0) {
  console.log(
    `🔄 Filtered out ${filteredCount} UID attributes (VR='UI') from analysis`,
  )
}

console.log(`\n📊 DICOM Whitelist Analysis`)
console.log(`Total attributes: ${attributes.length}`)
console.log(`\n🔍 Potentially Problematic Categories:\n`)

// Define patterns that might indicate identifying information
const suspiciousPatterns = [
  {
    name: 'Patient/Person Information',
    pattern: /patient|person|human|subject|individual/i,
    description: 'Attributes containing patient/person references',
  },
  {
    name: 'Names & Identifiers',
    pattern: /name|id(?!entif)|identifier|reference/i,
    description: 'Attributes that might contain names or IDs',
  },
  {
    name: 'Institutional Information',
    pattern:
      /institution|hospital|clinic|department|station|operator|physician|doctor/i,
    description: 'Institution, department, or personnel information',
  },
  {
    name: 'Dates & Times',
    pattern: /date|time|birth|age|created|modified|performed|scheduled/i,
    description: 'Temporal information that might be identifying',
  },
  {
    name: 'Location & Address',
    pattern: /address|location|country|region|city|zip|postal|geographic/i,
    description: 'Geographic or location information',
  },
  {
    name: 'Contact Information',
    pattern: /phone|telephone|email|contact|communication/i,
    description: 'Contact details',
  },
  {
    name: 'Study/Series Information',
    pattern: /study|series|accession|visit|appointment|protocol/i,
    description: 'Study/series metadata that might be identifying',
  },
  {
    name: 'Equipment & Software',
    pattern: /manufacturer|model|version|software|device|equipment|serial/i,
    description: 'Equipment details that might be identifying',
  },
  {
    name: 'Comments & Descriptions',
    pattern: /comment|description|note|remark|text|string/i,
    description: 'Free-text fields that might contain identifying info',
  },
]

// Analyse each category
suspiciousPatterns.forEach(({ name, pattern, description }) => {
  const matches = attributes.filter((attr) => pattern.test(attr))

  if (matches.length > 0) {
    console.log(`\n🚨 ${name} (${matches.length} attributes)`)
    console.log(`   ${description}`)

    // Show first 10 matches, sorted alphabetically
    const sortedMatches = matches.sort()
    const displayMatches = sortedMatches.slice(0, 10)
    displayMatches.forEach((attr) => {
      console.log(`   • ${attr}`)
    })

    if (matches.length > 10) {
      console.log(`   ... and ${matches.length - 10} more`)
    }
  }
})

// Look for specific high-risk keywords
console.log(`\n\n🎯 High-Risk Keywords Analysis:\n`)

const highRiskKeywords = [
  'PatientName',
  'PatientID',
  'PatientBirthDate',
  'PatientAddress',
  'InstitutionName',
  'InstitutionAddress',
  'StationName',
  'OperatorName',
  'PhysicianName',
  'ReferringPhysician',
  'PerformingPhysician',
  'ReviewerName',
  'InterpreterName',
  'PatientTelephone',
  'PatientEmail',
  'PatientComments',
  'StudyComments',
  'SeriesComments',
  'ImageComments',
  'AdditionalPatientHistory',
  'OccupationComment',
  'PatientInsurancePlan',
  'PatientPrimaryLanguage',
  'PatientReligiousPreference',
  'EthnicGroup',
  'CountryOfResidence',
  'RegionOfResidence',
  'PatientState',
  'PatientCounty',
  'PatientZipCode',
]

const foundHighRisk = []
highRiskKeywords.forEach((keyword) => {
  if (attributes.includes(keyword)) {
    foundHighRisk.push(keyword)
  }
})

if (foundHighRisk.length > 0) {
  console.log(
    `Found ${foundHighRisk.length} high-risk attributes in whitelist:`,
  )
  foundHighRisk.forEach((attr) => {
    console.log(`   🔴 ${attr}`)
  })
} else {
  console.log(`✅ No obvious high-risk attributes found in whitelist`)
}

// Summary statistics
console.log(`\n\n📈 Summary Statistics:`)
console.log(`Total whitelist size: ${attributes.length} attributes`)

const totalSuspicious = suspiciousPatterns.reduce((sum, pattern) => {
  return sum + attributes.filter((attr) => pattern.pattern.test(attr)).length
}, 0)

console.log(
  `Potentially suspicious: ${totalSuspicious} attributes (${((totalSuspicious / attributes.length) * 100).toFixed(1)}%)`,
)
console.log(`High-risk matches: ${foundHighRisk.length} attributes`)

console.log(`\n💡 Next Steps:`)
console.log(`1. Review the suspicious categories above`)
console.log(`2. Cross-reference with DICOM standard documentation`)
console.log(
  `3. Consider context - some attributes may be safe despite suspicious names`,
)
console.log(`4. Create focused blacklist of truly problematic attributes`)
