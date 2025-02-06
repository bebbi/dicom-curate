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

// Optional function to create `params` used below.
createParams = function () {
  return {
    // Define where to find the reference site-subject id:
    // in folder naming or in dicom header
    centerSubjId: parser.getFilePathComp('centersubj'),
  }
}

modifications = function (params) {
  return {
    dicomHeader: {
      // List DICOM Header tags for which you want to change values:
      // It's important to assign something to PatientName and PatientID as otherwise
      // they will just get emptied by the default behaviour
      PatientName: params.centerSubjId,
      PatientID: params.centerSubjId,
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
      params.centerSubjId,
      parser.getDicom('SeriesNumber') +
        '=' +
        parser.getDicom('SeriesDescription'),
      parser.getDicom('InstanceNumber') + '.dcm',
    ],
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
