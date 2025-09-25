# DICOM Whitelist Review Scripts

This directory contains scripts to systematically review the DICOM attribute whitelist for potentially problematic attributes that might contain identifying information despite not being in PS3.15E1.1.

## Purpose

The DICOM de-identification process uses an **allow-list approach**:

- **Whitelist** = All PS3.06 attributes MINUS PS3.15E1.1 attributes (~4,500 attributes)
- **Problem**: As DICOM standard evolves, some whitelist attributes might contain identifying information
- **Solution**: Manual blacklist to override whitelist for problematic attributes

## Scripts Overview

### 1. `analyseWhitelist.js` - Broad Analysis

**Purpose**: Get an overview of potentially problematic attribute categories in the whitelist.

```bash
node scripts/analyseWhitelist.js
```

**Output**:

- Categorises all whitelist attributes by risk patterns
- Shows counts and examples for each category
- Identifies obvious high-risk attributes
- Provides summary statistics

**Use when**: Starting a new whitelist review or getting overall picture.

---

### 2. `focusedWhitelistReview.js` - Priority Analysis

**Purpose**: Create a prioritised list of attributes most likely to need blacklisting.

```bash
node scripts/focusedWhitelistReview.js
```

**Output**:

- Priority-ranked list of risky attributes (CRITICAL, HIGH, MEDIUM)
- Exports `whitelist_review_priority.csv` for systematic review
- Shows top 20 highest priority attributes
- Provides specific risk reasoning

**Use when**: Need a systematic review plan with clear priorities.

---

### 3. `dicomAttributeChecker.js` - Detailed Analysis

**Purpose**: Get detailed information about specific DICOM attributes.

```bash
node scripts/dicomAttributeChecker.js "AttributeName1" "AttributeName2" ...
```

**Example**:

```bash
node scripts/dicomAttributeChecker.js "CommentsOnPatientPerformanceOfVisualField" "InstructionText"
```

**Output**:

- DICOM tag, VR (Value Representation), VM (Value Multiplicity)
- Risk assessment based on VR type
- Pattern-based risk analysis
- Decision guidance

**Use when**: Investigating specific attributes during manual review.

---

### 4. `extractHighRiskAttributes.js` - Blacklist Generator

**Purpose**: Extract CRITICAL and HIGH risk attributes from CSV analysis and format them for the blacklist array.

```bash
node scripts/extractHighRiskAttributes.js
```

**Output**:

- Ready-to-use TypeScript array format
- All CRITICAL and HIGH risk attributes from your actual whitelist
- Copy-paste ready for `manualBlacklist.ts`

**Use when**: Ready to populate the blacklist with analyzed high-risk attributes.

## Recommended Review Process

### Initial Setup (First Time)

1. **Get Overview**: Run `analyseWhitelist.js` to understand scope
2. **Create Priority List**: Run `focusedWhitelistReview.js` to get CSV
3. **Extract High-Risk Attributes**: Run `extractHighRiskAttributes.js` to get blacklist array

### Systematic Review

1. **Open Priority CSV**: Use `whitelist_review_priority.csv` in spreadsheet software
2. **Start with CRITICAL**: Focus on free-text fields first
3. **Check Each Attribute**:
   ```bash
   node scripts/dicomAttributeChecker.js "AttributeName"
   ```
4. **Research Standard**: Check DICOM PS3.06 definition
5. **Make Decision**: Add to blacklist if confirmed problematic
6. **Update Blacklist**: Add to `src/config/dicom/manualBlacklist.ts`

### Periodic Updates (As DICOM Standard Evolves)

1. **Regenerate Whitelist**: Run whitelist generation scripts
2. **Re-run Analysis**: Use these scripts to identify new problematic attributes
3. **Review Changes**: Compare with previous analysis results
4. **Update Blacklist**: Add newly identified problematic attributes

## Files Generated

- `whitelist_review_priority.csv` - Prioritised list for systematic review
- Analysis output in terminal - Save important findings

## Implementation

### Current Manual Blacklist Location

```
src/config/dicom/manualBlacklist.ts
```

### How It Works

1. **Priority Order**: Manual Blacklist > PS3.15E1.1 Rules > Whitelist
2. **Integration**: Automatically applied in `deidentifyPS315E.ts`
3. **Tracking**: Blacklisted attributes marked with reason `'manualBlacklist'`

### Adding Attributes to Blacklist

```typescript
export const manualBlacklist: string[] = [
  // Add verified problematic attributes here
  'CommentsOnPatientPerformanceOfVisualField',
  'InstructionText',
  'ContactDisplayName',
  // ... more attributes
]
```

## Risk Assessment Guidelines

### **HIGH RISK - Likely Blacklist**

- **Free Text Fields**: LT, ST, UT VR types
- **Person Names**: PN VR type
- **Contact Information**: Phone, email, address fields
- **Institution Info**: Hospital, department, station names
- **Comments**: Any comment or description fields

### **MEDIUM RISK - Manual Review Required**

- **Dates/Times**: Could be identifying when combined
- **Patient Context**: Non-geometric patient-related fields
- **Protocol Names**: Might be institution-specific
- **Equipment Info**: Serial numbers, custom configurations

### **LOW RISK - Likely Safe**

- **Numeric Values**: IS, DS, FL, FD VR types
- **UIDs**: Already handled separately
- **Code Strings**: CS VR type (controlled vocabulary)
- **Geometric Data**: Patient positioning, orientation coordinates

## Additional Resources

- **DICOM Standard**: PS3.06 Data Dictionary
- **Online Reference**: https://dicom.innolitics.com/ciods/
- **VR Definitions**: DICOM PS3.05 Section 6.2
- **PS3.15E**: Confidentiality profiles and de-identification

## Important Notes

- **Manual Verification Required**: Automated analysis provides guidance, not final decisions
- **Context Matters**: Some "risky" attributes might be safe in specific use cases
- **Test Thoroughly**: Always test blacklist changes with real DICOM data
- **Document Decisions**: Keep record of why attributes were blacklisted
- **Regular Reviews**: DICOM standard evolves - review blacklist periodically

## Quick Start Example

```bash
# 1. Get overview
node scripts/analyseWhitelist.js

# 2. Create priority list
node scripts/focusedWhitelistReview.js

# 3. Extract high-risk attributes for blacklist
node scripts/extractHighRiskAttributes.js

# 4. Check specific attributes if needed
node scripts/dicomAttributeChecker.js "CommentsOnPatientPerformanceOfVisualField"

# 5. Add attributes to blacklist
# Edit: src/config/dicom/manualBlacklist.ts with desired attributes
```
