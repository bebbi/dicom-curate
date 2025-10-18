import { collectUidsToReplace } from './deidentifyPS315E'
import type { TNaturalData } from 'dcmjs'

describe('deidentifyPS315E', () => {
  describe('collectUidsToReplace', () => {
    it('should collect UIDs when retainUIDsOption is Off', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
        PatientName: 'Test Patient',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.200')
      expect(uids).toContain('1.2.3.4.300')
      expect(uids.length).toBe(3)
    })

    it('should return empty array when retainUIDsOption is Hashed', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Hashed',
      })

      expect(uids).toEqual([])
    })

    it('should return empty array when retainUIDsOption is On', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'On',
      })

      expect(uids).toEqual([])
    })

    it('should ignore empty UID values', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '',
        SOPInstanceUID: '1.2.3.4.300',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.300')
      expect(uids).not.toContain('')
      expect(uids.length).toBe(2)
    })

    it('should not collect PS3.06 registry UIDs', () => {
      const naturalData: TNaturalData = {
        SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // From uidRegistryPS3_06_A1
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).not.toContain('1.2.840.10008.5.1.4.1.1.2')
      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.200')
      expect(uids).toContain('1.2.3.4.300')
    })

    it('should collect UIDs from nested sequences', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
        ReferencedImageSequence: [
          {
            ReferencedSOPInstanceUID: '1.2.3.4.400',
            ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // From uidRegistryPS3_06_A1
          },
          {
            ReferencedSOPInstanceUID: '1.2.3.4.500',
          },
        ],
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.200')
      expect(uids).toContain('1.2.3.4.300')
      expect(uids).toContain('1.2.3.4.400')
      expect(uids).toContain('1.2.3.4.500')
      expect(uids).not.toContain('1.2.840.10008.5.1.4.1.1.2')
    })

    it('should handle deeply nested sequences', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        ReferencedImageSequence: [
          {
            ReferencedSOPInstanceUID: '1.2.3.4.400',
            DerivationImageSequence: [
              {
                SourceImageSequence: [
                  {
                    ReferencedSOPInstanceUID: '1.2.3.4.500',
                  },
                ],
              },
            ],
          },
        ],
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.400')
      expect(uids).toContain('1.2.3.4.500')
    })

    it('should handle empty sequences', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        ReferencedImageSequence: [],
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids.length).toBe(1)
    })

    it('should ignore non-UID attributes', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        PatientName: 'Test Patient',
        PatientID: '12345',
        StudyDate: '20231201',
        Modality: 'CT',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).not.toContain('Test Patient')
      expect(uids).not.toContain('12345')
      expect(uids).not.toContain('20231201')
      expect(uids).not.toContain('CT')
      expect(uids.length).toBe(1)
    })

    it('should handle retired UID tags with RETIRED_ prefix', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        RETIRED_DetachedStudyManagementSOPInstanceUID: '1.2.3.4.999',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      // Retired tag is not in ps315EElements, so it's not collected
      expect(uids).not.toContain('1.2.3.4.999')
      expect(uids.length).toBe(1)
    })

    it('should ignore internal attributes (starting with underscore)', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        _InternalUID: '1.2.3.4.999', // Should be ignored
        _meta: {
          SomeInternalUID: '1.2.3.4.888',
        },
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).not.toContain('1.2.3.4.999')
      expect(uids).not.toContain('1.2.3.4.888')
    })

    it('should collect multiple UID attributes from ps315EElements', () => {
      const naturalData: TNaturalData = {
        StudyInstanceUID: '1.2.3.4.100',
        SeriesInstanceUID: '1.2.3.4.200',
        SOPInstanceUID: '1.2.3.4.300',
        ReferencedSOPInstanceUID: '1.2.3.4.400',
        FrameOfReferenceUID: '1.2.3.4.500',
        SynchronizationFrameOfReferenceUID: '1.2.3.4.600',
        ConcatenationUID: '1.2.3.4.700',
      }

      const uids = collectUidsToReplace({
        naturalData,
        retainUIDsOption: 'Off',
      })

      expect(uids).toContain('1.2.3.4.100')
      expect(uids).toContain('1.2.3.4.200')
      expect(uids).toContain('1.2.3.4.300')
      expect(uids).toContain('1.2.3.4.400')
      expect(uids).toContain('1.2.3.4.500')
      expect(uids).toContain('1.2.3.4.600')
      expect(uids).toContain('1.2.3.4.700')
    })
  })
})
