import type { TCurationSpecification } from '../types'

/*
 * Sample of a 2-pass curation specification.
 * First pass: collect the mapping input from the listing
 * Second pass: load the mapping output from the CSV file
 *
 * First pass to be called without getMapping() calls:
 * firstPassSpec() { return {
 *   ...sample2PassCurationSpecification(),
 *   modifyDicomHeaders(parser) { return {}},
 *   errors(parser) { return [] },
 * }}
 */
export function sample2PassCurationSpecification(): TCurationSpecification {
  // Confirm hostProps for this transfer.
  const hostProps = {
    protocolNumber: 'Sample_Protocol_Number',
    activityProviderName: 'Sample_CRO',
    centerSubjectId: /^[A-Z]{2}\d{2}-\d{3}$/,
    timepointNames: ['Visit 1', 'Visit 2', 'Visit 3', 'EXCLUDE'],
    scanNames: ['PET-CT', 'PET', 'CT'],
  }

  return {
    // Review the required input folder structure (all DICOM files need minimally this folder depth)
    // This configuration depends on correct centerSubjectId, timepoint, scan folder names.
    inputPathPattern: 'any',

    additionalData: {
      // type listing is to collect the mapping input in a first pass.
      type: 'listing',
      // function if firstPass
      collect: (parser) => {
        const lookups = {
          PatNamePatId: ['PatientName', 'PatientID']
            .map(parser.getDicom)
            .join('='),
          PatNameIDSeriesDesc: ['PatientName', 'PatientID', 'SeriesDescription']
            .map(parser.getDicom)
            .join('='),
        }
        return {
          lookups,
          info: [
            // [label, value]
            ['Protocol Number', hostProps.protocolNumber],
            ['Patient Name', parser.getDicom('PatientName')],
            ['Patient ID', parser.getDicom('PatientID')],
            ['Study Date', parser.getDicom('StudyDate')],
            ['Study Description', parser.getDicom('StudyDescription')],
            ['Series Date', parser.getDicom('SeriesDate')],
            ['Series Description', parser.getDicom('SeriesDescription')],
            ['Modality', parser.getDicom('Modality')],
          ],
          // This will imply a CSV with headers:
          // PatNamePatId | PatNameIDSeriesDesc | CenterSubjectId | Timepoint | Comment
          // [lookup header, format, lookup value]
          collect: [
            ['CenterSubjectId', hostProps.centerSubjectId, 'PatNamePatId'],
            // For now, collecting this on Series not Study level.
            // Trade-off is re-use (study level) vs avoiding confusion due to
            // any mismatch on study vs series level (e.g. 2 studies one visit)
            ['Timepoint', hostProps.timepointNames, 'PatNameIDSeriesDesc'],
            ['ScanName', hostProps.scanNames, 'PatNameIDSeriesDesc'],
            ['Comment', /.*/, 'PatNameIDSeriesDesc'],
          ],
        }
      },
      // With this, can refer to mappings as parser.getMapping('blindedId')
      mapping: {
        // firstPass situation
        centerSubjectId: {
          value: (parser) =>
            ['PatientName', 'PatientID'].map(parser.getDicom).join('='),
          lookup: (row) => row['PatNamePatId'],
          replace: (row) => row['CenterSubjectId'],
        },
        timepoint: {
          value: (parser) =>
            ['PatientName', 'PatientID', 'SeriesDescription']
              .map(parser.getDicom)
              .join('='),
          lookup: (row) => row['PatNameIDSeriesDesc'],
          replace: (row) => row['Timepoint'],
        },
        scanName: {
          value: (parser) =>
            ['PatientName', 'PatientID', 'SeriesDescription']
              .map(parser.getDicom)
              .join('='),
          lookup: (row) => row['PatNameIDSeriesDesc'],
          replace: (row) => row['ScanName'],
        },
      },
    },

    version: '3.0',
    hostProps,

    // This specifies the standardized DICOM de-identification
    dicomPS315EOptions: {
      cleanDescriptorsOption: true,
      cleanDescriptorsExceptions: ['SeriesDescription'],
      retainLongitudinalTemporalInformationOptions: 'Full',
      retainPatientCharacteristicsOption: [
        'PatientsWeight',
        'PatientsSize',
        'PatientsAge',
        'PatientsSex',
        'SelectorASValue',
      ],
      retainDeviceIdentityOption: true,
      retainUIDsOption: 'Hashed',
      retainSafePrivateOption: 'Quarantine',
      retainInstitutionIdentityOption: true,
    },

    modifyDicomHeader(parser) {
      const centerSubjectId = String(parser.getMapping!('centerSubjectId'))
      const timepoint = String(parser.getMapping!('timepoint'))
      const scanName = String(parser.getMapping!('scanName'))

      return {
        // Align the PatientID DICOM header with the centerSubjectId folder name.
        PatientID: centerSubjectId,
        // This example maps PatientIDs based on the mapping CSV file.
        // PatientID: parser.getMapping('blindedId'),
        PatientName: centerSubjectId,
        // Align the StudyDescription DICOM header with the timepoint folder name.
        StudyDescription: timepoint,
        // The party responsible for assigning a standard ClinicalTrialSeriesDescription
        // ClinicalTrialCoordinatingCenterName: hostProps.activityProviderName,
        // Align the ClinicalTrialSeriesDescription DICOM header with the scan folder name.
        ClinicalTrialSeriesDescription: scanName,
      }
    },

    outputFilePathComponents(parser) {
      const centerSubjectId = String(parser.getMapping!('centerSubjectId'))
      const timepoint = String(parser.getMapping!('timepoint'))
      const scanName = String(parser.getMapping!('scanName'))

      return [
        hostProps.protocolNumber,
        centerSubjectId,
        timepoint,
        scanName + '=' + parser.getDicom('SeriesNumber'),
        parser.getFilePathComp(parser.FILEBASENAME) + '.dcm',
      ]
    },

    // This section defines the validation rules for the input DICOMs.
    // The processing continues on errors, but errors will have to be fixed
    // or reviewed between the parties.
    errors(parser) {
      const filename = parser.getFilePathComp(parser.FILENAME)
      const seriesUid = parser.getDicom('SeriesInstanceUID')
      const centerSubjectId = String(parser.getMapping!('centerSubjectId'))
      const timepoint = String(parser.getMapping!('timepoint'))
      const scanName = String(parser.getMapping!('scanName'))

      return [
        // File path
        [
          'Invalid site-subject format',
          !centerSubjectId.match(hostProps.centerSubjectId),
        ],
        [
          'Invalid timepoint descriptor',
          !hostProps.timepointNames.includes(timepoint),
        ],
        ['Invalid scan descriptor', !hostProps.scanNames.includes(scanName)],
        // DICOM header
        ['Missing Modality', parser.missingDicom('Modality')],
        ['Missing SOP Class UID', parser.missingDicom('SOPClassUID')],
        [
          'Duplicate File Name(s) in series',
          !parser.isUniqueInGroup(filename, seriesUid),
        ],
        [
          'Missing Series Instance UID',
          parser.missingDicom('SeriesInstanceUID'),
        ],
        ['Missing Study Instance UID', parser.missingDicom('StudyInstanceUID')],
        ['Missing SOP Instance UID', parser.missingDicom('SOPInstanceUID')],
      ]
    },
  }
}
