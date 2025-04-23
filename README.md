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
  inputPathPattern, // map input structure to variable names to use in the mapping
  mappingScript, // Image Transfer Agreement file handle
  ps315Options, // optional, normally provided as part of mappingScript
  columnMapping, // csv file handle to add csv-based mapping
}

// Read input, map headers, write to well-structured output.
apply(options)
```

An example mapping script file:

```js
DICOMPS315EOptions = {
  cleanDescriptorsOption: true,
  cleanDescriptorsExceptions: [
    'SeriesDescription',
    'ClinicalTrialSeriesDescription',
  ],
  // Offset dates per subject based on a CSV with individual offset durations.
  retainLongitudinalTemporalInformationOptions: [
    'filePath',
    'centersubj',
    'CURR_ID',
    'DATE_OFFSET_ISO8601',
  ],
  // Only considers listed attributes that are defined in PS3.15 E1.1
  // under the "retainPatientCharacteristicsOption".
  retainPatientCharacteristicsOption: [
    'PatientsWeight',
    'PatientsSize',
    'PatientsAge',
    'SelectorASValue',
  ],
  // Calibration dates, scanner IDs, etc.
  retainDeviceIdentityOption: true,
  // Change instance UIDs
  retainUIDsOption: false,
  // retain private tags
  retainSafePrivateOption: 'Quarantine',
  // retain institution-related information per PS3.15 E1.1
  retainInstitutionIdentityOption: true,
}

// This maps the actual input file path name to variables we can use in
// the mapping, specifically createParams() and modifications()
inputPathPattern = 'trialname/centersubj/dicomseriesid/'

// An optional function to create `params` used in modifications(params) function.
createParams = function () {
  return {
    // Define where to find the reference site-subject id:
    // The reference could be in folder names or in dicom header
    subjectId: parser.getFilePathComp('centersubj'),
  }
}

modifications = function (params) {
  return {
    // List DICOM Header tags for which you want to change values:
    // It's important to assign something to PatientName and PatientID as otherwise
    // they will just get emptied by the default behaviour
    dicomHeader: {
      PatientName: params.subjectId,
      PatientID: params.subjectId,
    },
    // outputFilePath lists the components of the new path to be written to the output
    // directory.
    // This example builds the output path from a mix of input path and DICOM headers.
    outputFilePathComponents: [
      parser.getFilePathComp('trialname'),
      params.subjectId,
      parser.getDicom('SeriesNumber') +
        '=' +
        parser.getDicom('SeriesDescription'),
      parser.getDicom('InstanceNumber') + '.dcm',
    ],
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
