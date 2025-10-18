import * as dcmjs from 'dcmjs'
import { collectUidsFromFile } from './collectUids'
import type {
  TFileInfo,
  TMappingOptions,
  TCurationSpecification,
} from './types'

// Mock a simple DICOM file
function createMockDicomFile(uids: {
  studyInstanceUID?: string
  seriesInstanceUID?: string
  sopInstanceUID?: string
  referencedSOPInstanceUID?: string
}): ArrayBuffer {
  const dicomDict = dcmjs.data.DicomMetaDictionary.naturalizeDataset({
    '00080018': { vr: 'UI', Value: [uids.sopInstanceUID || '1.2.3.4.5'] },
    '0020000D': { vr: 'UI', Value: [uids.studyInstanceUID || '1.2.3.4.6'] },
    '0020000E': { vr: 'UI', Value: [uids.seriesInstanceUID || '1.2.3.4.7'] },
  })

  if (uids.referencedSOPInstanceUID) {
    dicomDict.ReferencedSOPInstanceUID = uids.referencedSOPInstanceUID
  }

  const meta = {
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    TransferSyntaxUID: dcmjs.data.DicomMetaDictionary.uid(),
    ImplementationClassUID: dcmjs.data.DicomMetaDictionary.uid(),
    ImplementationVersionName: 'dicom-curate-test',
  }

  const denaturalizedMeta =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(meta)
  const denaturalizedDataset =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(dicomDict)

  const dicomData = new dcmjs.data.DicomDict(denaturalizedMeta)
  dicomData.dict = denaturalizedDataset

  return dicomData.write()
}

function createMockCurationSpec(
  retainUIDsOption: 'On' | 'Off' | 'Hashed',
): () => TCurationSpecification {
  return () => ({
    version: '3.0',
    modifyDicomHeader: () => ({}),
    outputFilePathComponents: () => ['output'],
    errors: () => [],
    inputPathPattern: 'test',
    hostProps: {},
    dicomPS315EOptions: {
      cleanDescriptorsOption: false,
      cleanDescriptorsExceptions: false,
      retainLongitudinalTemporalInformationOptions: 'Off',
      retainPatientCharacteristicsOption: false,
      retainDeviceIdentityOption: false,
      retainUIDsOption,
      retainSafePrivateOption: 'Off',
      retainInstitutionIdentityOption: false,
    },
  })
}

describe('collectUids', () => {
  describe('collectUidsFromFile', () => {
    // Helper to create file info from test UIDs
    async function testWithRetainOption(
      retainUIDsOption: 'On' | 'Off' | 'Hashed',
      testUids: {
        studyInstanceUID: string
        seriesInstanceUID: string
        sopInstanceUID: string
      },
    ) {
      const buffer = createMockDicomFile(testUids)
      const blob = new Blob([buffer])

      const fileInfo: TFileInfo = {
        path: 'test',
        name: 'test.dcm',
        size: blob.size,
        kind: 'blob',
        blob,
      }

      const mappingOptions: TMappingOptions = {
        curationSpec: createMockCurationSpec(retainUIDsOption),
      }

      return collectUidsFromFile(fileInfo, mappingOptions)
    }

    it('should collect UIDs when retainUIDsOption is Off', async () => {
      const testUids = {
        studyInstanceUID: '1.2.3.4.100',
        seriesInstanceUID: '1.2.3.4.200',
        sopInstanceUID: '1.2.3.4.300',
      }

      const uids = await testWithRetainOption('Off', testUids)

      expect(uids).toContain(testUids.studyInstanceUID)
      expect(uids).toContain(testUids.seriesInstanceUID)
      expect(uids).toContain(testUids.sopInstanceUID)
      expect(uids.length).toBeGreaterThan(0)
    })

    it('should return empty array when retainUIDsOption is Hashed', async () => {
      const testUids = {
        studyInstanceUID: '1.2.3.4.100',
        seriesInstanceUID: '1.2.3.4.200',
        sopInstanceUID: '1.2.3.4.300',
      }

      const uids = await testWithRetainOption('Hashed', testUids)
      expect(uids).toEqual([])
    })

    it('should return empty array when retainUIDsOption is On', async () => {
      const testUids = {
        studyInstanceUID: '1.2.3.4.100',
        seriesInstanceUID: '1.2.3.4.200',
        sopInstanceUID: '1.2.3.4.300',
      }

      const uids = await testWithRetainOption('On', testUids)
      expect(uids).toEqual([])
    })

    it('should return empty array when dicomPS315EOptions is Off', async () => {
      const testUids = {
        studyInstanceUID: '1.2.3.4.100',
        seriesInstanceUID: '1.2.3.4.200',
        sopInstanceUID: '1.2.3.4.300',
      }

      const buffer = createMockDicomFile(testUids)
      const blob = new Blob([buffer])

      const fileInfo: TFileInfo = {
        path: 'test',
        name: 'test.dcm',
        size: blob.size,
        kind: 'blob',
        blob,
      }

      const mappingOptions: TMappingOptions = {
        curationSpec: () => ({
          version: '3.0',
          modifyDicomHeader: () => ({}),
          outputFilePathComponents: () => ['output'],
          errors: () => [],
          inputPathPattern: 'test',
          hostProps: {},
          dicomPS315EOptions: 'Off',
        }),
      }

      const uids = await collectUidsFromFile(fileInfo, mappingOptions)

      expect(uids).toEqual([])
    })

    it('should handle file read errors gracefully', async () => {
      const fileInfo: TFileInfo = {
        path: 'test',
        name: 'invalid.dcm',
        size: 100,
        kind: 'blob',
        blob: new Blob([]), // Empty blob - will cause parse error
      }

      const mappingOptions: TMappingOptions = {
        curationSpec: createMockCurationSpec('Off'),
      }

      const uids = await collectUidsFromFile(fileInfo, mappingOptions)

      // Should return empty array on error, not throw
      expect(uids).toEqual([])
    })

    it('should collect duplicate UIDs within the same file', async () => {
      const testUids = {
        studyInstanceUID: '1.2.3.4.100',
        seriesInstanceUID: '1.2.3.4.100', // Duplicate
        sopInstanceUID: '1.2.3.4.300',
      }

      const uids = await testWithRetainOption('Off', testUids)

      // Deduplication happens in generateSharedUidMappings, not here
      expect(uids).toContain(testUids.studyInstanceUID)
      expect(uids).toContain(testUids.sopInstanceUID)
    })
  })
})
