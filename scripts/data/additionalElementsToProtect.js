// Known sensitive tags that are missing from PS3.15E1.1
export const additionalElementsToProtect = [
  // XxDescriptionTrial = 'Xx Description/Comment (Trial)': more descriptions, retired
  'AlgorithmDescriptionTrial',
  'AnatomicLocationOfExaminingInstrumentDescriptionTrial',
  'AnatomicPerspectiveDescriptionTrial',
  'IdentificationDescriptionTrial',
  'MeasurementPrecisionDescriptionTrial',
  'ReportStatusCommentTrial',
  'RequestedProcedureDescriptionTrial',
  'SpecimenDescriptionTrial',
  // 'CommentsOn..': alternative comments naming convention
  'CommentsOnPatientPerformanceOfVisualField',
  'CommentsOnRadiationDose',
  'CommentsOnThePerformedProcedureStep',
  'CommentsOnTheScheduledProcedureStep',
  // General possibly identifiable attributes
  'ContactDisplayName',
  'ContactMethod',
  'ContactURI',
  'InstructionText',
  'LabelText',
  'PatientAlternativeCalendar',
  'PatientBirthDateInAlternativeCalendar',
  'PatientBirthDateInAlternativeCalendar',
  'PatientDeathDateInAlternativeCalendar',
  'PatientDeathDateInAlternativeCalendar',
  'SecondaryReviewerName',
]
