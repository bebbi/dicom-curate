# dcm-organize

Organize and de-identify DICOM header values and file hierarchies based on a provided configuration object.

## Why

This provides an open configuration language and a ready-to-use library for modifying DICOM headers for the purpose of de-identification and organization.

The library can be used in a toolkit-agnostic way, because it provides access to functionality to modify decoded DICOM headers in "DICOM json" format.

## Usage

Converting a nested input folder structure containing DICOM files to a cleaned output folder destination:

```ts
import apply, { OrganizeOptions } from 'dcm-organize'

const options: OrganizeOptions = {
  inputDirectory, // input folder directory handle
  outputDirectory, // output folder directory handle
  mappingScript, // Image Transfer Agreement file handle
  columnMapping, // csv file handle to add csv-based mapping
}

// Read input, map headers, write to well-structured output.
apply(options)
```

An example mapping script file:

<!-- Snippet auto-generated from ../testdata/sampleMappingSpecification.js -->
```js
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
          // DICOM header
          ['Missing Modality', parser.missingDicom('Modality')],
        ],
      }
    },
  }
}
```

## DICOM Conformance Notes

dcm-organize

- does not use an Encrypted Attributes Sequence
- does not anonymize burnt-in information or modify PixelData
- populates the `PatientIdentityRemoved` attribute with `YES`
- populates the `LongitudinalTemporalInformationModified` attribute per DICOM PS3.15E
- populates the `DeidentificationMethod` attribute with information about this README
- populates the `DeidentificationMethodCodeSequence` with the CID7050 codes of provided options, per PS3.15E
- keeps only the following in File Meta Information:
  'FileMetaInformationVersion', 'ImplementationClassUID', 'ImplementationVersionName',
  'MediaStorageSOPClassUID', as well as setting the 'TransferSyntaxUID' to 'Explit little Endian', and 'MediaStorageSOPInstanceUID' to the correct SOP instance UID.
- cleans sequences ('SQ') by recursively applying the de-identification rules to each Dataset in each Item of the Sequence.
- uses an allow-list approach, by removing everything not defined in PS3.06 or handled in PS3.15E1.1.
- identifies and removes additional ID attributes beyond PS3.15E1.1 by parsing PS3.06 and finding all attributes ending on "ID(s)", but not UID(s) that are not defined in PS3.15E. This ID list is defined in "src/config/dicom/retainAdditionalIds.ts", and a few of them are manually annotated to be retained if the "retain device identifier option" is activated.
- keeps the 'EncapsulatedDocument' attribute if modality is "DOC", unless overridden
- keeps the 'VerifyingObserverSequence' if modality is SR, unless overridden
- allows the users to describe all cleaning configurations in the mappingScripts file
- implements the following PS3.15E options:
  - 'retainDeviceIdentityOption': Keeps the attributes marked as 'K' and performs the default action on all other attributes
  - 'cleanDescriptorsOption' by removing all description and comment Attributes except those comment attributes explicitly listed in the `cleanDescriptorExceptions` list.
  - 'retainLongitudinalTemporalInformationOptions': this considers all temporal attributes (DA, TM, DT), as described as a possible approach in PS3.15E.
    Possible values are 'Full' (keep all temporal info intact), 'Off' (remove all temporal attributes or add defaults per PS3.15E), or accepts a list to offset all temporal information consistently by ISO-8601 compliant durations. Example:
    for the patient id defined in the folder path, replace dates per a per-subject csv 'DATE_OFFSET' column: `['filePath', 'centersubj', 'SUBJECT_ID', 'DATE_OFFSET']`
  - 'retainDeviceIdentityOption': true or false. If true, overrides `retainLongitudinalTemporalInformationOptions` for the respective attributes to keep.
  - 'retainUIDsOption': 'On', 'Off', or 'Hashed'.
    - If 'On', maintain all UIDs.
    - If 'Off', replaces instance UIDs with arbitrary new UIDs, maintaining referential integrity within a single run.
      - maximum protection
      - only maintains referential integrity within a run
      - do not use for de-identifying data in multiple batches
    - If 'Hashed', creates a new UID using an using a decentrally repeatable, hash-based method.
      - maintains referential integrity even if de-identifying data in separate, or decentralized, batches
      - use if the risk of re-identifying by UID is not bigger than the risk of re-identifying by PixelData
      - do not use if you want to specifically protect UIDs from an auxiliary knowledge attack, e.g. an attacker that knows possible input UIDs
    - There are more instance UIDs in part PS3.06 than described in PS3.15E for protection, therefore this option identifies the following uids for protection: 1. All instance UIDs per PS3.15E, 2. Any additional UIDs with a value not well-known in DICOM, per table PS3.06A (Registry of DICOM Unique Identifiers). This protects instance UIDs but also private class UIDs, which is intentional.
  - 'retainSafePrivateOption': 'Quarantine' or 'Off'. If 'Quarantine', keeps all private tags but creates a quarantine log for manual review
  - 'retainInstitutionIdentityOption': true or false
- does not currently clean structured content
