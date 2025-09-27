// Manual blacklist of DICOM attributes that should be removed during de-identification
// even if they are present in the whitelist (elementNamesToAlwaysKeep)
//
// These attributes are blacklisted because they can contain identifying information
// that is not captured by PS3.15E1.1 rules. Each attribute in this list has been
// manually reviewed and determined to pose a privacy risk.
//
// PRIORITY SYSTEM:
// 1. cleanDescriptorsExceptions (highest) - user-specified exceptions always preserved
// 2. Manual Blacklist - these attributes are always removed (except exceptions)
// 3. PS3.15E1.1 rules - standard de-identification rules
// 4. Whitelist (lowest) - attributes kept by default
//
// NOTE: UIDs are filtered out during analysis phase and never reach this blacklist
//
// This list should be periodically reviewed as the DICOM standard evolves.
// Use the scripts in /scripts/ to analyse the whitelist for new problematic attributes.

/**
 * Manual blacklist of DICOM attribute keywords that should always be removed
 * during de-identification, regardless of their presence in the whitelist.
 *
 * Priority is: Manual Blacklist > PS3.15E1.1 rules > Whitelist
 */
export const manualBlacklist: string[] = [
  // ========================================================================
  // ATTRIBUTES EXCLUDED FROM BLACKLIST (commented out with reasons)
  // ========================================================================

  // === UIDs (Unique Identifiers) ===
  // UIDs are excluded because they have special handling in the de-identification logic
  // and are processed according to retainUIDsOption settings
  // 'ContextGroupExtensionCreatorUID',
  // 'ContextUID',
  // 'RTVCommunicationSOPClassUID',
  // 'RTVCommunicationSOPInstanceUID',

  // === Technical/Equipment Identifiers ===
  // These are generally safe as they identify equipment models, not patients
  // 'DetectorID',
  // 'DeviceSerialNumber',
  // 'SoftwareVersions',
  // 'StationName',
  // 'ManufacturerModelName',

  // === Coded Values ===
  // Code sequences are generally safe as they contain standardized codes, not free text
  // 'AnatomicRegionSequence',
  // 'ProcedureCodeSequence',
  // 'ViewCodeSequence',
  // Most *CodeSequence attributes contain structured codes rather than free text

  // === Dates/Times ===
  // These are handled by PS3.15E1.1 temporal rules and longitudinal options
  // 'AcquisitionDate',
  // 'StudyDate',
  // 'SeriesDate',
  // 'ContentDate',

  // === Standard Measurements & Technical Parameters ===
  // Pure numeric measurements and technical settings without identifying context
  // 'SliceThickness',
  // 'PixelSpacing',
  // 'ImageOrientationPatient', (geometric data, not identifying)
  // 'WindowCenter',
  // 'WindowWidth',
  // 'RescaleIntercept',
  // 'RescaleSlope',

  // === Protocol Names (Standardized) ===
  // Many protocol names are standardized and don't contain patient info
  // 'ProtocolName', (often standardized, but can contain custom text - keep monitoring)
  // 'SeriesDescription', (often standardized, handled by cleanDescriptors options)

  // === Sequence Attributes (Structured Data) ===
  // Most sequence attributes contain structured data rather than free text
  // 'ReferencedImageSequence',
  // 'SourceImageSequence',
  // 'DerivationImageSequence',
  // 'ConceptNameCodeSequence',
  // 'MeasurementUnitsCodeSequence',

  // === Numeric IDs and Indices ===
  // These are typically numeric identifiers without patient information
  // 'InstanceNumber',
  // 'SeriesNumber',
  // 'AcquisitionNumber',
  // 'ImageIndex',
  // 'FrameNumber',

  // === Standard Enumerated Values & Boolean Flags ===
  // These contain predefined enumerated values, not free text
  // 'Modality',
  // 'PhotometricInterpretation',
  // 'PlanarConfiguration',
  // 'SamplesPerPixel',
  // 'BitsAllocated',
  // 'BitsStored',
  // 'PatientIdentityRemoved', (CS - YES/NO)
  // 'PatientMotionCorrected', (CS - YES/NO)
  // 'ShowPatientDemographicsFlag', (CS - YES/NO)
  // 'ContextGroupExtensionFlag', (CS - Y/N)
  // 'FilterByOperator', (CS - enumerated values)
  // 'PatientEyeMovementCommanded', (CS - YES/NO)

  // === Network/Communication (Technical) ===
  // Technical network parameters, not patient identifying
  // 'NetworkID', (if it's just network infrastructure)
  // 'Port',
  // 'HostName', (depends on naming convention - could be identifying)

  // === Geometric/Spatial Data ===
  // Pure geometric data without patient context
  // 'ImagePositionPatient', (spatial coordinates, not identifying)
  // 'SliceLocation',
  // 'SpacingBetweenSlices',
  // 'TableHeight',

  // === Color/Display Parameters ===
  // Technical display parameters
  // 'RedPaletteColorLookupTableData',
  // 'GreenPaletteColorLookupTableData',
  // 'BluePaletteColorLookupTableData',

  // ========================================================================
  // EXCLUSION CRITERIA SUMMARY:
  //
  // Attributes are excluded from the blacklist if they:
  // 1. Are UIDs (handled by special UID processing logic)
  // 2. Contain only technical/equipment parameters (non-patient identifying)
  // 3. Are standardized coded values (structured, not free text)
  // 4. Are boolean flags or enumerated values (CS VR with controlled vocabulary)
  // 5. Are pure numeric measurements without context
  // 6. Are already handled by existing PS3.15E1.1 rules
  // 7. Are sequence attributes with structured data only
  //
  // When in doubt, err on the side of privacy - include in blacklist
  // ========================================================================

  // ========================================================================
  // BLACKLISTED ATTRIBUTES (high risk for containing identifying information)
  // ========================================================================
  //
  // NOTE: Description and Comment fields are NOT included here because they are
  // already handled systematically by the cleanDescriptorsOption in PS3.15E1.1
  // (see deidentifyPS315E.ts:370). This avoids redundancy and maintains consistency
  // with the standard approach for descriptor handling.
  //

  'ASLContext',
  'BoundingBoxTextHorizontalJustification',
  'CalibrationNotes',
  'ContextGroupIdentificationSequence',
  'ContextIdentifier',
  'HistogramExplanation',
  'InstructionText',
  'LUTExplanation',
  'MaskOperationExplanation',
  'MaterialNotes',
  'ObservationSubjectContextFlagTrial',
  'ObserverContextFlagTrial',
  'PixelValueMappingExplanation',
  'PreAmplifierNotes',
  'ProbeDriveNotes',
  'ProcedureContextFlagTrial',
  'ProcedureContextSequenceTrial',
  'ProtocolContextSequence',
  'PulserNotes',
  'ROIObservationContextCodeSequence',
  'RTImageFrameContextSequence',
  'ReceiverNotes',
  'ReferencedStructuredContextSequence',
  'ReferencedTextureSequence',
  'StructuredDisplayTextBoxSequence',
  'SubstanceAdministrationNotes',
  'TextColorCIELabValue',
  'TextObjectSequence',
  'TextStyleSequence',
  'TextValue',
  'TextureLabel',
  'UnformattedTextValue',
  'WindowCenterWidthExplanation',
  'AssigningAgencyOrDepartmentCodeSequence',
  'ClinicalFractionNumber',
  'ClinicalTrialTimePointTypeCodeSequence',
  'ConsentForClinicalTrialUseSequence',
  'OphthalmicPatientClinicalInformationLeftEyeSequence',
  'OphthalmicPatientClinicalInformationRightEyeSequence',
  'PatientClinicalTrialParticipationSequence',
  'PerformedStationClassCodeSequence',
  'RTPhysicianIntentIndex',
  'RTPhysicianIntentInputInstanceSequence',
  'RTPhysicianIntentPredecessorSequence',
  'RTPhysicianIntentSequence',
  'ReferencedRTPhysicianIntentIndex',
  'ReferencedRTPhysicianIntentSequence',
  'RequestingPhysicianIdentificationSequence',
  'ScheduledStationClassCodeSequence',
  'SecondaryReviewerName',
  'CalciumScoringMassFactorPatient',
  'ColumnAngulationPatient',
  'DataCollectionCenterPatient',
  'DistanceSourceToPatient',
  'GroupOfPatientsIdentificationSequence',
  'ImageOrientationPatient',
  'ImagePositionPatient',
  'IssuerOfPatientIDQualifiersSequence',
  'NumberOfPatientRelatedInstances',
  'NumberOfPatientRelatedSeries',
  'NumberOfPatientRelatedStudies',
  'PatientAlternativeCalendar',
  'PatientBirthDateInAlternativeCalendar',
  'PatientBodyMassIndex',
  'PatientBreedCodeSequence',
  'PatientDeathDateInAlternativeCalendar',
  'PatientEquipmentRelationshipCodeSequence',
  'PatientEyeMovementCommandCodeSequence',
  'PatientGantryRelationshipCodeSequence',
  'PatientNotProperlyFixatedQuantity',
  'PatientPhysiologicalStateCodeSequence',
  'PatientPhysiologicalStateSequence',
  'PatientReliabilityIndicator',
  'PatientSizeCodeSequence',
  'PatientSpeciesCodeSequence',
  'PatientSpecificationSequence',
  'PatientTreatmentPreparationDeviceSequence',
  'PatientTreatmentPreparationMethodCodeSequence',
  'PatientTreatmentPreparationProcedureCodeSequence',
  'PatientTreatmentPreparationProcedureIndex',
  'PatientTreatmentPreparationProcedureParameterSequence',
  'PatientTreatmentPreparationProcedureSequence',
  'ReconstructionTargetCenterPatient',
  'RefractiveParametersUsedOnPatientSequence',
  'SourcePatientGroupIdentificationSequence',
  'SourceToPatientSurfaceDistance',
  'TypeOfPatientID',
  'CompressionContactArea',
  'ContactDisplayName',
  'ContactMethod',
  'ContactURI',
  'NTPSourceAddress',
  'ProcedureStepCommunicationsURISequence',
  'ReceivingPresentationAddress',
  'SendingPresentationAddress',
  'SourcePresentationAddress',
]

/**
 * Set of blacklisted attributes for fast lookup during de-identification
 */
export const manualBlacklistSet = new Set(manualBlacklist)
