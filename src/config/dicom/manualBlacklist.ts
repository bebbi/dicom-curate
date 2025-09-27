// Manual blacklist of DICOM attributes that should be removed during de-identification
// even if they are present in the whitelist (elementNamesToAlwaysKeep)
//
// These attributes are blacklisted because they can contain identifying information
// that is not captured by PS3.15E1.1 rules. Each attribute in this list has been
// manually reviewed and determined to pose a privacy risk.
//
// PRIORITY SYSTEM:
// 1. cleanDescriptorsExceptions (highest) - user-specified exceptions always preserved
// 2. Manual Blacklist - these attributes are always removed (except for UIDs and exceptions)
// 3. PS3.15E1.1 rules - standard de-identification rules
// 4. Whitelist (lowest) - attributes kept by default
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

  // === Standard Enumerated Values ===
  // These contain predefined enumerated values, not free text
  // 'Modality',
  // 'PhotometricInterpretation',
  // 'PlanarConfiguration',
  // 'SamplesPerPixel',
  // 'BitsAllocated',
  // 'BitsStored',

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
  // 4. Are pure numeric measurements without context
  // 5. Are already handled by existing PS3.15E1.1 rules
  // 6. Are sequence attributes with structured data only
  //
  // When in doubt, err on the side of privacy - include in blacklist
  // ========================================================================

  // ========================================================================
  // BLACKLISTED ATTRIBUTES (high risk for containing identifying information)
  // ========================================================================

  'ASLContext',
  'ASLCrusherDescription',
  'ASLTechniqueDescription',
  'AcquisitionContextDescription',
  'AlgorithmDescription',
  'AlgorithmDescriptionTrial',
  'AlternateContentDescriptionSequence',
  'AnatomicLocationOfExaminingInstrumentDescriptionTrial',
  'AnatomicPerspectiveDescriptionTrial',
  'ApplicableSafetyStandardDescription',
  'ApplicatorDescription',
  'ApprovalStatusFurtherDescription',
  'AssertionComments',
  'AssessmentSummaryDescription',
  'AudioComments',
  'BoundingBoxTextHorizontalJustification',
  'CalculatedDoseReferenceDescription',
  'CalculationComment',
  'CalculationCommentSequence',
  'CalculationCommentType',
  'CalibrationNotes',
  'ChannelDerivationDescription',
  'ChannelDescriptionCodeSequence',
  'CommentsOnPatientPerformanceOfVisualField',
  'CommentsOnTheScheduledProcedureStep',
  'CompletionFlagDescription',
  'CompressionDescription',
  'ConfigurationDescription',
  'ConfigurationInformationDescription',
  'ContainerComponentDescription',
  'ContentDescription',
  'ContextGroupExtensionFlag',
  'ContextGroupIdentificationSequence',
  'ContextIdentifier',
  'CoordinateSystemAxisDescription',
  'CurveDescription',
  'DataBlockDescription',
  'DataElementDescription',
  'DataSetDescription',
  'DetectorDescription',
  'DimensionDescriptionLabel',
  'DisplaySetPresentationGroupDescription',
  'DisplaySubsystemDescription',
  'DoseComment',
  'EffectiveDoseCalculationMethodDescription',
  'ExposureControlModeDescription',
  'FiducialDescription',
  'FieldOfViewDescription',
  'FrameOfInterestDescription',
  'FrameOfReferenceTransformationComment',
  'GeneralAccessoryDescription',
  'GeneticModificationsDescription',
  'GraphicGroupDescription',
  'GraphicLayerDescription',
  'HPGLPenDescription',
  'HangingProtocolDescription',
  'HistogramExplanation',
  'IdentificationDescriptionTrial',
  'ImageFilterDescription',
  'ImplantTemplateGroupDescription',
  'IndicationDescription',
  'InstructionDescription',
  'InstructionPerformanceComment',
  'InstructionText',
  'InterventionDescription',
  'InventoryInstanceDescription',
  'LUTExplanation',
  'LateralSpreadingDeviceDescription',
  'LensConstantDescription',
  'LensDescription',
  'LensStatusDescription',
  'LuminanceResponseDescription',
  'MaskOperationExplanation',
  'MaterialNotes',
  'MaterialPropertiesDescription',
  'MeasuredDoseDescription',
  'MeasurementPrecisionDescriptionTrial',
  'MetaboliteMapDescription',
  'MultiplexedAudioChannelsDescriptionCodeSequence',
  'ObservationDescription',
  'ObservationSubjectContextFlagTrial',
  'ObserverContextFlagTrial',
  'OphthalmicAxialLengthDataSourceDescription',
  'OphthalmicAxialLengthQualityMetricTypeDescription',
  'OphthalmicImageTypeDescription',
  'OpticalPathDescription',
  'OverlayCompressionDescription',
  'OverlayDescription',
  'PTOLocationDescription',
  'PaddleDescription',
  'PartialViewDescription',
  'PatientBreedDescription',
  'PatientSpeciesDescription',
  'PerformedProcedureTypeDescription',
  'PhaseDescription',
  'PixelSpacingCalibrationDescription',
  'PixelValueMappingExplanation',
  'PlanningLandmarkDescription',
  'PreAmplifierNotes',
  'PrintJobDescriptionSequence',
  'PrivateDataElementDescription',
  'ProbeDriveNotes',
  'ProcedureContextFlagTrial',
  'ProcedureContextSequenceTrial',
  'ProcedureStepProgressDescription',
  'ProductDescription',
  'ProtocolContextSequence',
  'PulserNotes',
  'RGBATransferFunctionDescription',
  'ROIObservationContextCodeSequence',
  'RTImageDescription',
  'RTImageFrameContextSequence',
  'RangeModulatorDescription',
  'RangeShifterDescription',
  'ReasonForChannelOmissionDescription',
  'ReceiverNotes',
  'ReconstructionDescription',
  'ReferenceLocationDescription',
  'ReferencedStructuredContextSequence',
  'ReferencedTextureSequence',
  'ReportStatusCommentTrial',
  'RequestedProcedureDescriptionTrial',
  'RequestedSeriesDescriptionCodeSequence',
  'ResourceDescription',
  'SOPAuthorizationComment',
  'SegmentDescription',
  'SeriesDescriptionCodeSequence',
  'SetupDeviceDescription',
  'SetupImageComment',
  'SetupReferenceDescription',
  'SourceDescription',
  'SpecimenDescriptionSequence',
  'SpecimenDescriptionSequenceTrial',
  'SpecimenDescriptionTrial',
  'StrainDescription',
  'StructuredDisplayTextBoxSequence',
  'SubstanceAdministrationNotes',
  'SurfaceComments',
  'SurfaceModelDescriptionSequence',
  'SurfaceProcessingDescription',
  'SystemStatusComment',
  'TestResultComment',
  'TextColorCIELabValue',
  'TextObjectSequence',
  'TextStyleSequence',
  'TextValue',
  'TextureLabel',
  'TherapyDescription',
  'ThreatCategoryDescription',
  'TrackSetDescription',
  'TransactionStatusComment',
  'TransformDescription',
  'TreatmentStatusComment',
  'TreatmentTerminationDescription',
  'USImageDescriptionSequence',
  'UnformattedTextValue',
  'VitreousStatusDescription',
  'WedgeDescription',
  'WindowCenterWidthExplanation',
  'AssigningAgencyOrDepartmentCodeSequence',
  'ClinicalFractionNumber',
  'ClinicalTrialTimePointTypeCodeSequence',
  'ConsentForClinicalTrialUseSequence',
  'FilterByOperator',
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
  'PatientEyeMovementCommanded',
  'PatientGantryRelationshipCodeSequence',
  'PatientIdentityRemoved',
  'PatientMotionCorrected',
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
  'ShowPatientDemographicsFlag',
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
  'WedgeInContactLength',
  'WedgeInContactWidth',
]

/**
 * Set of blacklisted attributes for fast lookup during de-identification
 */
export const manualBlacklistSet = new Set(manualBlacklist)
