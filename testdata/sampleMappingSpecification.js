mappingSpecification = () => {
  // Confirm allowed identifiers for this transfer.
  const identifiers = {
    protocolNumber: 'Sample_Protocol_Number',
    activityProviderName: 'Sample_CRO',
    centerSubjectId: /^[A-Z]{3}\d{2}-\d{4}$/,
    timepointNames: ['Visit 1', 'Visit 2', 'Visit 3'],
    // Folder "scan": the trial-specific/provider-assigned series name
    scanNames: ['Sample_Series_Desciption'],
  }

  return {
    // Review the required input folder structure (all DICOM files need minimally this folder depth)
    // This configuration depends on correct centerSubjectId, timepoint, scan folder names.
    inputPathPattern:
      'protocolNumber/activityProvider/centerSubjectId/timepoint/scan',

    // A CSV file is required if mappingCsvHeaders is not empty.
    mappingCsvHeaders: {
      //   CURR_ID: identifiers.centerSubjectId,
      //   NEW_ID: /\d+/,
    },

    version: '1.0',
    identifiers,

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

    // This section defines the output folder structure and alignment of DICOM headers
    modifications(parser) {
      const scan = parser.getFilePathComp('scan')
      const centerSubjectId = parser.getFilePathComp('centerSubjectId')

      return {
        dicomHeader: {
          // Align the PatientID DICOM header with the centerSubjectId folder name.
          PatientID: centerSubjectId,
          // This example maps PatientIDs based on the mapping CSV file.
          // PatientID: parser.getMapping(parser.getDicom('PatientID'), 'CURR_ID', 'MAPPED_ID'),
          PatientName: centerSubjectId,
          // Align the StudyDescription DICOM header with the timepoint folder name.
          StudyDescription: parser.getFilePathComp('timepoint'),
          // The party responsible for assigning a standard ClinicalTrialSeriesDescription
          ClinicalTrialCoordinatingCenterName: identifiers.activityProviderName,
          // Align the ClinicalTrialSeriesDescription DICOM header with the scan folder name.
          ClinicalTrialSeriesDescription: scan,
        },

        // This defines the output folder structure.
        outputFilePathComponents: [
          parser.getFilePathComp('protocolNumber'),
          parser.getFilePathComp('activityProvider'),
          centerSubjectId,
          parser.getFilePathComp('timepoint'),
          parser.getFilePathComp('scan') +
            '=' +
            parser.getDicom('SeriesNumber'),
          parser.getFilePathComp(parser.FILEBASENAME) + '.dcm',
        ],
      }
    },

    // This section defines the validation rules for the input DICOMs.
    // The processing continues on errors, but errors will have to be fixed
    // or reviewed between the parties.
    validation(parser) {
      const modality = parser.getDicom('Modality')
      const filename = parser.getFilePathComp(parser.FILEBASENAME)
      const seriesUid = parser.getDicom('SeriesInstanceUID')

      return {
        errors: [
          // File path
          [
            'Invalid study folder name',
            parser.getFilePathComp('protocolNumber') !==
              identifiers.protocolNumber,
          ],
          [
            'Invalid provider name',
            parser.getFilePathComp('activityProvider') !==
              identifiers.activityProviderName,
          ],
          [
            'Invalid site-subject format',
            !parser
              .getFilePathComp('centerSubjectId')
              .match(identifiers.centerSubjectIdPattern),
          ],
          [
            'Invalid timepoint descriptor',
            !identifiers.timepointNames.includes(
              parser.getFilePathComp('timepoint'),
            ),
          ],
          [
            'Invalid scan descriptor',
            !identifiers.scanNames.includes(parser.getFilePathComp('scan')),
          ],
          // DICOM header
          ['Missing Modality', parser.missingDicom('Modality')],
          ['Missing SOP Class UID', parser.missingDicom('SOPClassUID')],
          ['Missing Instance Number(s)', parser.missingDicom('InstanceNumber')],
          [
            'Duplicate File Name(s) in series',
            !parser.isUniqueInGroup(filename, seriesUid),
          ],
          [
            'Missing Series Instance UID',
            parser.missingDicom('SeriesInstanceUID'),
          ],
          [
            'Missing Study Instance UID',
            parser.missingDicom('StudyInstanceUID'),
          ],
          ['Missing SOP Instance UID', parser.missingDicom('SOPInstanceUID')],
          ['Missing Study Date', parser.missingDicom('StudyDate')],
          ['Missing Series Date', parser.missingDicom('SeriesDate')],
          ['Missing Acquisition Date', parser.missingDicom('AcquisitionDate')],
          ['Missing Study Time', parser.missingDicom('StudyTime')],
          ['Missing Series Time', parser.missingDicom('SeriesTime')],
          ['Missing Patient Weight', parser.missingDicom('PatientWeight')],
          ['Missing Patient Size', parser.missingDicom('PatientSize')],
          ['Missing Patient Age', parser.missingDicom('PatientAge')],
          ['Missing Patient Sex', parser.missingDicom('PatientSex')],
          ['Missing Acquisition Time', parser.missingDicom('AcquisitionTime')],
          [
            'Missing Image Position (Patient)',
            parser.missingDicom('ImagePositionPatient'),
          ],
          [
            'Missing Number of Energy Windows on NM',
            parser.missingDicom('NumberOfEnergyWindows') && modality === 'NM',
          ],
          [
            'Missing Energy Window Information Sequence on NM',
            parser.missingDicom('EnergyWindowInformationSequence') &&
              modality === 'NM',
          ],
          [
            'Missing Energy Window Range Sequence on NM',
            parser.missingDicom(
              'EnergyWindowInformationSequence[0].EnergyWindowRangeSequence',
            ) && modality === 'NM',
          ],
          [
            'Missing Radiopharmaceutical Information Sequence on NM',
            parser.missingDicom('RadiopharmaceuticalInformationSequence') &&
              modality === 'NM',
          ],
          [
            'Missing Series Type on PET',
            parser.missingDicom('SeriesType') && modality === 'PT',
          ],
          [
            'Missing Pixel Spacing on NM or PT or CT',
            parser.missingDicom('PixelSpacing') &&
              ['NM', 'PT', 'CT'].includes(modality),
          ],
        ],
      }
    },
  }
}
