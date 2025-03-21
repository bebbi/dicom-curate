mappingSpecification = () => {
  const identifiers = {
    protocolNumber: 'UNCONFIGURED',
    activityProviderName: 'UNCONFIGURED',
    centerSubjectId: /^\d{4}_\d{5}$/,
    timepointNames: ['UNCONFIGURED'],
    scanNames: ['UNCONFIGURED'],
  }

  return {
    version: '1.0',
    /*
     * Adjust per transfer.
     */

    // Naming convention
    identifiers,

    // If object has own props, then ask for a mapping csv.
    mappingCsvHeaders: {
      //   CURR_ID: identifiers.centerSubjectId,
      //   DATE_OFFSET: /\d+/,
    },

    /*
     * Do not modify below here.
     *******************************************************************************
     */

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
      retainSafePrivateOption: true,
      retainInstitutionIdentityOption: true,
    },

    // Define how to interpret the input path (all DICOMs need minimally this folder depth)
    inputPathPattern:
      'protocolNumber/activityProvider/centerSubjectId/timepoint/scan',

    // Required modifications function
    modifications(parser) {
      // Dicom "SeriesDescription" is the regular DICOM tag.
      // Folder "scan" is the trial-specific/provider-assigned series name
      const scan = parser.getFilePathComp('scan')
      const centerSubjectId = parser.getFilePathComp('centerSubjectId')

      return {
        dicomHeader: {
          PatientID: centerSubjectId,
          // // this example finds the PatientID in mapping table column 0 and offsets the CONTENTDATE by days per column 2
          // ContentDate:
          //   parser.addDays(parser.getDicom('StudyDate'), parser.getMapping(
          //     parser.getDicom('PatientID'), 'CURR_ID', 'DATE_OFFSET')),
          PatientName: centerSubjectId,
          StudyDescription: parser.getFilePathComp('timepoint'),
          ClinicalTrialSeriesDescription: scan,
        },
        outputFilePathComponents: [
          parser.getFilePathComp('protocolNumber'),
          parser.getFilePathComp('activityProvider'),
          centerSubjectId,
          parser.getFilePathComp('timepoint'),
          parser.getFilePathComp('scan'),
          // Sort by file name order since InstanceNumber is not guaranteed
          parser.getUniqueNumberInGroup(parser.getDicom('SeriesInstanceUID')) +
            '.dcm',
        ],
      }
    },

    validation(parser) {
      const modality = parser.getDicom('Modality')

      return {
        // Data provider/CRO has to fix.
        errors: [
          // Folder naming convention
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
