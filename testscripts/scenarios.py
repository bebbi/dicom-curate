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
mappingSpecification = () => {
  const identifiers = {
    protocolNumber: "UNCONFIGURED",
    activityProviderName: "UNCONFIGURED",
    centerSubjectId: /^\d{4}_\d{5}$/,
    timepointNames: ["UNCONFIGURED"],
    scanNames: ["UNCONFIGURED"],
  };

  return {
    version: "1.0",
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
      cleanDescriptorsExceptions: ["SeriesDescription"],
      retainLongitudinalTemporalInformationOptions: "Full",
      retainPatientCharacteristicsOption: [
        "PatientsWeight",
        "PatientsSize",
        "PatientsAge",
        "PatientsSex",
        "SelectorASValue",
      ],
      retainDeviceIdentityOption: true,
      retainUIDsOption: "Hashed",
      retainSafePrivateOption: true,
      retainInstitutionIdentityOption: true,
    },

    // Define how to interpret the input path (all DICOMs need minimally this folder depth)
    inputPathPattern:
      "protocolNumber/activityProvider/centerSubjectId/timepoint/scan",

    // Required modifications function
    modifications() {
      // Dicom "SeriesDescription" is the regular DICOM tag.
      // Folder "scan" is the trial-specific/provider-assigned series name
      const scan = parser.getFilePathComp("scan");
      const centerSubjectId = parser.getFilePathComp("centerSubjectId");

      return {
        dicomHeader: {
          PatientID: centerSubjectId,
          // // this example finds the PatientID in mapping table column 0 and offsets the CONTENTDATE by days per column 2
          // ContentDate:
          //   parser.addDays(parser.getDicom('StudyDate'), parser.getMapping(
          //     parser.getDicom('PatientID'), 'CURR_ID', 'DATE_OFFSET')),
          PatientName: centerSubjectId,
          StudyDescription: parser.getFilePathComp("timepoint"),
          ClinicalTrialSeriesDescription: scan,
        },
        outputFilePathComponents: [
          parser.getFilePathComp("protocolNumber"),
          parser.getFilePathComp("activityProvider"),
          centerSubjectId,
          parser.getFilePathComp("timepoint"),
          parser.getFilePathComp("scan"),
          parser.getDicom("InstanceNumber") + ".dcm",
        ],
      };
    },

    validation() {
      const modality = parser.getDicom("Modality");

      return {
        // Data provider/CRO has to fix.
        errors: [
          // Folder naming convention
          [
            "Invalid study folder name",
            parser.getFilePathComp("protocolNumber") !==
              identifiers.protocolNumber,
          ],
          [
            "Invalid provider name",
            parser.getFilePathComp("activityProvider") !==
              identifiers.activityProviderName,
          ],
          [
            "Invalid site-subject format",
            !parser
              .getFilePathComp("centerSubjectId")
              .match(identifiers.centerSubjectIdPattern),
          ],
          [
            "Invalid timepoint descriptor",
            !identifiers.timepointNames.includes(
              parser.getFilePathComp("timepoint")
            ),
          ],
          [
            "Invalid scan descriptor",
            !identifiers.scanNames.includes(parser.getFilePathComp("scan")),
          ],
          // DICOM header
          ["Missing Modality", parser.missingDicom("Modality")],
          ["Missing SOP Class UID", parser.missingDicom("SOPClassUID")],
          [
            "Missing Series Instance UID",
            parser.missingDicom("SeriesInstanceUID"),
          ],
          [
            "Missing Study Instance UID",
            parser.missingDicom("StudyInstanceUID"),
          ],
          ["Missing SOP Instance UID", parser.missingDicom("SOPInstanceUID")],
          ["Missing Instance Number(s)", parser.missingDicom("InstanceNumber")],
          [
            "Duplicate Instance Number(s)",
            !parser.isUniqueInGroup(instanceNumber, seriesUid),
          ],
          ["Missing Study Date", parser.missingDicom("StudyDate")],
          ["Missing Series Date", parser.missingDicom("SeriesDate")],
          ["Missing Acquisition Date", parser.missingDicom("AcquisitionDate")],
          ["Missing Study Time", parser.missingDicom("StudyTime")],
          ["Missing Series Time", parser.missingDicom("SeriesTime")],
          ["Missing Patient Weight", parser.missingDicom("PatientWeight")],
          ["Missing Patient Size", parser.missingDicom("PatientSize")],
          ["Missing Patient Age", parser.missingDicom("PatientAge")],
          ["Missing Patient Sex", parser.missingDicom("PatientSex")],
          ["Missing Acquisition Time", parser.missingDicom("AcquisitionTime")],
          [
            "Missing Image Position (Patient)",
            parser.missingDicom("ImagePositionPatient"),
          ],
          [
            "Missing Number of Energy Windows on NM",
            parser.missingDicom("NumberOfEnergyWindows") && modality === "NM",
          ],
          [
            "Missing Energy Window Information Sequence on NM",
            parser.missingDicom("EnergyWindowInformationSequence") &&
              modality === "NM",
          ],
          [
            "Missing Energy Window Range Sequence on NM",
            parser.missingDicom(
              "EnergyWindowInformationSequence[0].EnergyWindowRangeSequence"
            ) && modality === "NM",
          ],
          [
            "Missing Radiopharmaceutical Information Sequence on NM",
            parser.missingDicom("RadiopharmaceuticalInformationSequence") &&
              modality === "NM",
          ],
          [
            "Missing Series Type on PET",
            parser.missingDicom("SeriesType") && modality === "PT",
          ],
          [
            "Missing Pixel Spacing on NM or PT or CT",
            parser.missingDicom("PixelSpacing") &&
              ["NM", "PT", "CT"].includes(modality),
          ],
        ],
      };
    },
  };
};
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
