#!/usr/bin/env node

/**
 * Tool to help review specific DICOM attributes by showing their definitions and VR types
 * Usage: node dicomAttributeChecker.js "AttributeName1" "AttributeName2" ...
 */

// No file system operations needed for this script

// Get attributes from command line arguments
const attributesToCheck = process.argv.slice(2)

if (attributesToCheck.length === 0) {
  console.log(
    `Usage: node dicomAttributeChecker.js "AttributeName1" "AttributeName2" ...`,
  )
  console.log(
    `\nExample: node dicomAttributeChecker.js "PatientComments" "InstitutionName"`,
  )
  process.exit(1)
}

// Load dcmjs to get DICOM dictionary information
let nameMap
try {
  const dcmjs = await import('dcmjs')
  nameMap = dcmjs.data.DicomMetaDictionary.nameMap
} catch (error) {
  console.error('Error loading dcmjs:', error.message)
  console.log('Note: Install dcmjs to get detailed DICOM definitions')
  nameMap = null
}

console.log(`🔍 DICOM Attribute Analysis\n`)

attributesToCheck.forEach((attribute, index) => {
  console.log(`${index + 1}. ${attribute}`)
  console.log(`${'='.repeat(attribute.length + 3)}`)

  if (nameMap && nameMap[attribute]) {
    const info = nameMap[attribute]
    console.log(`   Tag: ${info.tag}`)
    console.log(`   VR:  ${info.vr}`)
    console.log(`   VM:  ${info.vm}`)

    // Analyse VR type for risk assessment
    const vrRiskAssessment = {
      LO: 'MEDIUM - Long String (64 chars max, could contain identifying text)',
      SH: 'MEDIUM - Short String (16 chars max, limited risk)',
      LT: 'HIGH - Long Text (10240 chars max, high risk for identifying info)',
      ST: 'HIGH - Short Text (1024 chars max, high risk for identifying info)',
      UT: 'CRITICAL - Unlimited Text (unlimited length, very high risk)',
      PN: 'CRITICAL - Person Name (designed for names, very high risk)',
      CS: 'LOW - Code String (controlled vocabulary, usually safe)',
      UI: 'LOW - Unique Identifier (UIDs are handled separately)',
      SQ: 'VARIES - Sequence (depends on contents)',
      DA: 'MEDIUM - Date (temporal information can be identifying)',
      DT: 'MEDIUM - Date Time (temporal information can be identifying)',
      TM: 'MEDIUM - Time (temporal information can be identifying)',
      IS: 'LOW - Integer String (numeric values, usually safe)',
      DS: 'LOW - Decimal String (numeric values, usually safe)',
      FD: 'LOW - Floating Point Double (numeric values, usually safe)',
      FL: 'LOW - Floating Point Single (numeric values, usually safe)',
      UL: 'LOW - Unsigned Long (numeric values, usually safe)',
      US: 'LOW - Unsigned Short (numeric values, usually safe)',
      SS: 'LOW - Signed Short (numeric values, usually safe)',
      SL: 'LOW - Signed Long (numeric values, usually safe)',
    }

    const riskAssessment =
      vrRiskAssessment[info.vr] || 'UNKNOWN - Review manually'
    console.log(`   Risk: ${riskAssessment}`)
  } else {
    console.log(`   ❌ Not found in DICOM dictionary`)
    console.log(
      `   This might be a retired, private, or incorrectly named attribute`,
    )
  }

  // Pattern-based risk analysis
  const riskPatterns = [
    {
      pattern: /comment|description|text|note/i,
      risk: 'HIGH',
      reason: 'Free text field',
    },
    {
      pattern: /name|id$/i,
      risk: 'HIGH',
      reason: 'Likely contains names or identifiers',
    },
    {
      pattern: /institution|hospital|station|operator/i,
      risk: 'HIGH',
      reason: 'Institutional information',
    },
    {
      pattern: /patient(?!.*(?:orientation|position|support|coordinate))/i,
      risk: 'MEDIUM',
      reason: 'Patient-related (non-geometric)',
    },
    {
      pattern: /date|time|birth|age/i,
      risk: 'MEDIUM',
      reason: 'Temporal information',
    },
    {
      pattern: /contact|phone|email|address/i,
      risk: 'CRITICAL',
      reason: 'Contact information',
    },
  ]

  const matchedPatterns = riskPatterns.filter(({ pattern }) =>
    pattern.test(attribute),
  )
  if (matchedPatterns.length > 0) {
    console.log(`   Pattern Analysis:`)
    matchedPatterns.forEach(({ risk, reason }) => {
      console.log(`     • ${risk} - ${reason}`)
    })
  }

  console.log()
})

console.log(`\n💡 Quick Decision Guide:`)
console.log(
  `   🔴 BLACKLIST if: Free text (LT/ST/UT), Person Names (PN), Contact info, Institution info`,
)
console.log(
  `   🟡 REVIEW if: Dates/Times, Patient context, Long strings with identifying patterns`,
)
console.log(
  `   🟢 LIKELY SAFE if: Numeric values, UIDs, Code strings, Geometric/positioning data`,
)

console.log(`\n📚 For detailed definitions, check:`)
console.log(`   • DICOM Standard PS3.06 Data Dictionary`)
console.log(`   • https://dicom.innolitics.com/ciods/`)
console.log(`   • Your local DICOM documentation`)
