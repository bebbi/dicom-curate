"""
test script to generate data scenarios for dcm-organize

This script should be runable in a vanilla python environment
to create directories for testing.
"""

import argparse
import os
import tempfile

try:
    import idc_index
except ModuleNotFoundError:
    print("Please `pip install --upgrade idc-index`")
    exit(-1)

def create_scenario(args):
  """
  Args:
    args: The command line arguments defining the scenario
  """
  try:
    if os.path.exists(args.output_directory):
      if args.verbose:
        print("Output directory {args.output_directory} already exists")
    else:
      os.makedirs(args.output_directory, exist_ok=True)
      if args.verbose:
          print(f"Output directory '{args.output_directory}' created successfully.")
  except OSError as e:
    print(f"Error creating output directory: {e}")

  if args.verbose:
    print(f"Generating scenario '{args.scenario}'.")

  if args.scenario == "default":
    scenarioDir = f"{args.output_directory}/defaultScenario"
    # default scenario, with a few subjects
    useTempDir = False
    if useTempDir:
      downloadDir = f"{tempfile.TemporaryDirectory().name}/dicomdata"
      if args.verbose:
        print(f"Downloading to '{downloadDir}'.")
    else:
      downloadDir = f"{scenarioDir}/dicomdata"
    os.makedirs(downloadDir, exist_ok=True)
    idcClient = idc_index.IDCClient()
    patientIDs = [
      "ACRIN-NSCLC-FDG-PET-001",
      "ACRIN-NSCLC-FDG-PET-002",
      "ACRIN-NSCLC-FDG-PET-003",
    ]
    for patientID in patientIDs:
      idcClient.download_from_selection(patientId=patientID, downloadDir=downloadDir, use_s5cmd_sync=True)

    with open(os.path.join(scenarioDir, "mapping.csv"), "w") as f:
      f.write("""CURR_ID,NEW_ID,DATE_OFFSET
ACRIN-NSCLC-FDG-PET-001,patient_1,20
ACRIN-NSCLC-FDG-PET-002,patient_2,-15
ACRIN-NSCLC-FDG-PET-003,patient_3,3
""")

    with open(os.path.join(scenarioDir, "mappingConfig.js"), "w") as f:
      f.write("""
DICOMPS315EOptions = {
  cleanDescriptorsOption: true,
  cleanDescriptorsExceptions: [
    'SeriesDescription',
    'ClinicalTrialSeriesDescription',
  ],
  retainLongitudinalTemporalInformationOptions: [
    'filePath',
    'centersubj',
    'CURR_ID',
    'DATE_OFFSET',
  ],
  // Only works for those attributes that are part of the PS3.15 E1.1
  // list under the retainPatientCharacteristicsOption.
  retainPatientCharacteristicsOption: [
    'PatientsWeight',
    'PatientsSize',
    'PatientsAge',
    'SelectorASValue',
  ],
  // Calibration dates, scanner IDs, etc.
  retainDeviceIdentityOption: true,
  retainUIDsOption: false,
  retainSafePrivateOption: true,
  retainInstitutionIdentityOption: true,
}

// This maps the input path to variables we can use in
// createParams() and modifications()
inputPathPattern = 'trialname/centersubj/dicomseriesid/'

modifications = function () {
  const centerSubjId = parser.getFilePathComp('centersubj')

  return {
    dicomHeader: {
      // List DICOM Header tags for which you want to change values:
      // It's important to assign something to PatientName and PatientID as otherwise
      // they will just get emptied by the default behaviour
      PatientName: centerSubjId,
      PatientID: centerSubjId,
      // // this example finds the PatientID in mapping table column 0 and offsets the CONTENTDATE by days per column 2
      // ContentDate:
      //   parser.addDays(parser.getDicom('StudyDate'), parser.getMapping(
      //     parser.getDicom('PatientID'), 'CURR_ID', 'DATE_OFFSET')),
    },
    // outputFilePath lists the components of the new path to be written.
    // If taken from old path, component names must be available in filePathPattern,
    // and actual file path must be deep enough for getFilePathComp to find its match
    outputFilePathComponents: [
      parser.getFilePathComp('trialname'),
      centerSubjId,
      parser.getDicom('SeriesNumber') +
        '=' +
        parser.getDicom('SeriesDescription'),
      parser.getDicom('InstanceNumber') + '.dcm',
    ],
  }
}

validation = function () {
  const modality = parser.getDicom('Modality')
  const instanceNumber = parser.getDicom('InstanceNumber')
  const seriesUid = parser.getDicom('SeriesInstanceUID')

  return {
    // Data provider/CRO has to fix.
    errors: [
      ['Missing Modality', parser.missingDicom('Modality')],
      ['Missing SOP Class UID', parser.missingDicom('SOPClassUID')],
      ['Missing Series Instance UID', parser.missingDicom('SeriesInstanceUID')],
      ['Missing Study Instance UID', parser.missingDicom('StudyInstanceUID')],
      ['Missing SOP Instance UID', parser.missingDicom('SOPInstanceUID')],
      ['Missing Instance Number(s)', parser.missingDicom('InstanceNumber')],
      [
        'Duplicate Instance Number(s)',
        !parser.isUniqueInGroup(instanceNumber, seriesUid),
      ],
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
    // We check and fix if needed
    quarantine: [],
  }
}
""")

  if args.verbose:
    print(f"Scenario '{args.scenario}' created successfully.")


def main():
  parser = argparse.ArgumentParser(description="Create a testing scenario in a target directory.")
  parser.add_argument("-v", "--verbose", action="store_true", help="Increase output verbosity.")
  parser.add_argument("--scenario", type=str, default="default", help="The scenario to generate.")
  parser.add_argument("output_directory", help="Path to the output directory.")
  args = parser.parse_args()

  if args.verbose:
    print("Running in verbose mode.")

  create_scenario(args)

if __name__ == "__main__":
  main()
