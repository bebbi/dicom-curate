import curateDict from './curateDict'
import { sample } from '../testdata/sample'
import { TCurationSpecification, TMappingOptions } from './types'
import { specVersion } from './config/specVersion'

// Helper function to create test specifications with custom options
function specWithOptions(
  options: Partial<TCurationSpecification>,
): () => Partial<TCurationSpecification> {
  return () => ({
    version: specVersion,
    ...options,
  })
}

describe('Manual Blacklist functionality', () => {
  const defaultTestOptions: TMappingOptions = {
    columnMappings: { rows: [], rowIndexByFieldValue: {} },
    curationSpec: specWithOptions({
      dicomPS315EOptions: {
        cleanDescriptorsOption: false,
        cleanDescriptorsExceptions: [],
        retainLongitudinalTemporalInformationOptions: 'Off' as const,
        retainPatientCharacteristicsOption: [],
        retainDeviceIdentityOption: false,
        retainUIDsOption: 'Off' as const,
        retainSafePrivateOption: 'Off',
        retainInstitutionIdentityOption: false,
      },
    }),
  }

  it('removes attributes in manual blacklist with correct reason', () => {
    // Create test data with a blacklisted attribute
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add a blacklisted attribute that's in the whitelist
        // Using 'ASLContext' which is in our blacklist
        '0018A002': {
          vr: 'CS',
          Value: ['LABEL'],
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Verify the attribute was removed with correct reason
    const aslContextMapping = Object.entries(result.mapResults.mappings).find(
      ([path, mapping]) => path.includes('ASLContext'),
    )

    expect(aslContextMapping).toBeDefined()
    expect(aslContextMapping![1][1]).toBe('delete')
    expect(aslContextMapping![1][2]).toBe('manualBlacklist')
  })

  it('does not blacklist UIDs even if they are in manual blacklist', () => {
    // Create test data with a UID that would be in blacklist
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add a hypothetical UID attribute that might be blacklisted
        '00080018': {
          vr: 'UI',
          Value: ['1.2.3.4.5.6.7.8.9'],
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Verify UIDs are not removed by manual blacklist
    // (they should be handled by UID-specific logic instead)
    const manualBlacklistMappings = Object.entries(
      result.mapResults.mappings,
    ).filter(([path, mapping]) => mapping[2] === 'manualBlacklist')

    // Check that none of the manual blacklist mappings are for UIDs
    manualBlacklistMappings.forEach(([path, mapping]) => {
      // Get the DICOM tag from the path to check if it's a UID
      const tagMatch = path.match(/([0-9A-Fa-f]{8})/)
      if (tagMatch) {
        const tag = tagMatch[1].toUpperCase()
        // Check if this is the UID tag we added (00080018)
        expect(tag).not.toBe('00080018')
      }
    })
  })

  it('respects cleanDescriptorsExceptions over manual blacklist', () => {
    // Test that cleanDescriptorsExceptions takes priority over manual blacklist
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add ConfigurationInformationDescription which is blacklisted
        '20100152': {
          vr: 'LT',
          Value: [
            'Configuration info that should be preserved due to exception',
          ],
        },
      },
    }

    const specWithException = specWithOptions({
      dicomPS315EOptions: {
        cleanDescriptorsOption: true,
        cleanDescriptorsExceptions: ['ConfigurationInformationDescription'],
        retainLongitudinalTemporalInformationOptions: 'Off' as const,
        retainPatientCharacteristicsOption: [],
        retainDeviceIdentityOption: false,
        retainUIDsOption: 'Off' as const,
        retainSafePrivateOption: 'Off',
        retainInstitutionIdentityOption: false,
      },
    })

    const result = curateDict('test.dcm', 0, testData, {
      columnMappings: { rows: [], rowIndexByFieldValue: {} },
      curationSpec: specWithException,
    })

    // Verify the blacklisted attribute was NOT removed due to exception
    const configMapping = Object.entries(result.mapResults.mappings).find(
      ([path, mapping]) => path.includes('ConfigurationInformationDescription'),
    )

    // Should not be removed by manual blacklist due to exception
    if (configMapping) {
      expect(configMapping[1][2]).not.toBe('manualBlacklist')
    }

    // Verify the attribute exists in the final dicomData
    const configTag = result.dicomData.dict['20100152']
    expect(configTag).toBeDefined()
    expect(configTag.Value).toEqual([
      'Configuration info that should be preserved due to exception',
    ])
  })

  it('removes multiple blacklisted attributes in single operation', () => {
    // Test multiple blacklisted attributes at once
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add multiple blacklisted attributes
        '0018A002': {
          vr: 'CS',
          Value: ['LABEL'],
        },
        '0018A003': {
          vr: 'LO',
          Value: ['Test ASL description'],
        },
        '0018A004': {
          vr: 'LO',
          Value: ['Test technique description'],
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Count how many attributes were removed by manual blacklist
    const blacklistMappings = Object.entries(result.mapResults.mappings).filter(
      ([path, mapping]) => mapping[2] === 'manualBlacklist',
    )

    expect(blacklistMappings.length).toBeGreaterThan(0)

    // Verify each has correct reason and action
    blacklistMappings.forEach(([path, mapping]) => {
      expect(mapping[1]).toBe('delete')
      expect(mapping[2]).toBe('manualBlacklist')
      expect(mapping[3]).toBeUndefined()
    })
  })

  it('does not affect attributes not in blacklist', () => {
    // Test that non-blacklisted attributes are handled normally
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add a non-blacklisted attribute that should be kept (in whitelist)
        '00080060': {
          vr: 'CS',
          Value: ['CT'], // Modality - should be kept
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Verify modality was not removed by manual blacklist
    const modalityMapping = Object.entries(result.mapResults.mappings).find(
      ([path, mapping]) => path.includes('Modality'),
    )

    if (modalityMapping) {
      expect(modalityMapping[1][2]).not.toBe('manualBlacklist')
    }

    // Verify modality exists in final result
    const modalityTag = result.dicomData.dict['00080060']
    expect(modalityTag).toBeDefined()
  })

  it('handles empty blacklisted attributes correctly', () => {
    // Test that empty blacklisted attributes are not processed
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add blacklisted attribute with empty value
        '0018A002': {
          vr: 'CS',
          Value: [''], // Empty value
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Empty values should not be processed by manual blacklist
    const emptyBlacklistMappings = Object.entries(
      result.mapResults.mappings,
    ).filter(
      ([path, mapping]) =>
        mapping[2] === 'manualBlacklist' && mapping[0] === '',
    )

    expect(emptyBlacklistMappings.length).toBe(0)
  })

  it('manual blacklist has correct priority over whitelist', () => {
    // Test priority: Manual Blacklist > Whitelist
    const testData = {
      ...sample,
      dict: {
        ...sample.dict,
        // Add an attribute that's both in whitelist AND blacklist
        // ASLContext should be in whitelist but is blacklisted
        '0018A002': {
          vr: 'CS',
          Value: ['LABEL'],
        },
      },
    }

    const result = curateDict('test.dcm', 0, testData, defaultTestOptions)

    // Verify manual blacklist takes priority over whitelist
    const aslMapping = Object.entries(result.mapResults.mappings).find(
      ([path, mapping]) => path.includes('ASLContext'),
    )

    expect(aslMapping).toBeDefined()
    expect(aslMapping![1][1]).toBe('delete')
    expect(aslMapping![1][2]).toBe('manualBlacklist')

    // Verify attribute was actually removed from final data
    const aslTag = result.dicomData.dict['0018A002']
    expect(aslTag).toBeUndefined()
  })
})
