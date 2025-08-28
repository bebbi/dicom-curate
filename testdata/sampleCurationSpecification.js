/*
 * Curation specification for batch-curating DICOM files.
 */
export function sampleBatchCurationSpecification() {
  // Confirm hostProps for this transfer.
  const hostProps = {
    protocolNumber: 'Sample_Protocol_Number',
    activityProviderName: 'Sample_CRO',
    centerSubjectId: /^[A-Z]{2}\d{2}-\d{3}$/,
    timepointNames: ['Visit 1', 'Visit 2', 'Visit 3'],
    // Folder "scan": the trial-specific/provider-assigned series name
    scanNames: ['3DT1 Sagittal', 'PET-Abdomen'],
  }
  return {
    // Review the required input folder structure (all DICOM files need minimally this folder depth)
    // This configuration depends on correct centerSubjectId, timepoint, scan folder names.
    inputPathPattern:
      'protocolNumber/activityProvider/centerSubjectId/timepoint/scan',
    additionalData: {
      // collect from a csv file. A client can use regex to validate the input.
      type: 'load',
      collect: {
        CURR_ID: hostProps.centerSubjectId,
        StudyDescription: hostProps.timepointNames,
        MAPPED_ID: /BLIND_\d+/,
      },
      // With this, can refer to mappings as parser.getMapping('blindedId')
      mapping: {
        // Using the CSV
        blindedId: {
          value: (parser) => parser.getDicom('PatientID'),
          lookup: (row) => row['CURR_ID'],
          replace: (row) => row['MAPPED_ID'],
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
      const scan = parser.getFilePathComp('scan')
      const centerSubjectId = parser.getFilePathComp('centerSubjectId')
      return {
        // Align the PatientID DICOM header with the centerSubjectId folder name.
        PatientID: centerSubjectId,
        // This example maps PatientIDs based on the mapping CSV file.
        // PatientID: parser.getMapping('blindedId'),
        PatientName: centerSubjectId,
        // Align the StudyDescription DICOM header with the timepoint folder name.
        StudyDescription: parser.getFilePathComp('timepoint'),
        // The party responsible for assigning a standard ClinicalTrialSeriesDescription
        ClinicalTrialCoordinatingCenterName: hostProps.activityProviderName,
        // Align the ClinicalTrialSeriesDescription DICOM header with the scan folder name.
        ClinicalTrialSeriesDescription: scan,
      }
    },
    outputFilePathComponents(parser) {
      const scan = parser.getFilePathComp('scan')
      const centerSubjectId = parser.getFilePathComp('centerSubjectId')
      return [
        parser.getFilePathComp('protocolNumber'),
        parser.getFilePathComp('activityProvider'),
        centerSubjectId,
        parser.getFilePathComp('timepoint'),
        scan + '=' + parser.getDicom('SeriesNumber'),
        parser.getFilePathComp(parser.FILEBASENAME) + '.dcm',
      ]
    },
    // This section defines the validation rules for the input DICOMs.
    // The processing continues on errors, but errors will have to be fixed
    // or reviewed between the parties.
    errors(parser) {
      return [
        // File path
        [
          'Invalid study folder name',
          parser.getFilePathComp('protocolNumber') !== hostProps.protocolNumber,
        ],
        // DICOM header
        ['Missing Modality', parser.missingDicom('Modality')],
        ['Missing SOP Class UID', parser.missingDicom('SOPClassUID')],
      ]
    },
  }
}
