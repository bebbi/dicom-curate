import type { TPs315Options } from '../../types'

export const supportedCid7050: Record<
  | Exclude<
      keyof TPs315Options,
      | 'retainLongitudinalTemporalInformationOptions'
      | 'cleanDescriptorsExceptions'
    >
  | 'retainLongitudinalTemporalInformationFullDatesOptions'
  | 'retainLongitudinalTemporalInformationModifiedDatesOptions'
  | 'basicApplicationConfidentialityProfile',
  { value: string; meaning: string; scheme: 'DCM' }
> = {
  basicApplicationConfidentialityProfile: {
    value: '113100',
    meaning: 'Basic Application Confidentiality Profile',
    scheme: 'DCM',
  },
  cleanDescriptorsOption: {
    value: '113105',
    meaning: 'Clean Descriptors Option',
    scheme: 'DCM',
  },
  retainLongitudinalTemporalInformationFullDatesOptions: {
    value: '113106',
    meaning: 'Retain Longitudinal Temporal Information Full Dates Option',
    scheme: 'DCM',
  },
  retainLongitudinalTemporalInformationModifiedDatesOptions: {
    value: '113107',
    meaning: 'Retain Longitudinal Temporal Information Modified Dates Option',
    scheme: 'DCM',
  },
  retainPatientCharacteristicsOption: {
    value: '113108',
    meaning: 'Retain Patient Characteristics Option',
    scheme: 'DCM',
  },
  retainDeviceIdentityOption: {
    value: '113109',
    meaning: 'Retain Device Identity Option',
    scheme: 'DCM',
  },
  retainUIDsOption: {
    value: '113110',
    meaning: 'Retain UIDs Option',
    scheme: 'DCM',
  },
  retainSafePrivateOption: {
    value: '113111',
    meaning: 'Retain Safe Private Option',
    scheme: 'DCM',
  },
  retainInstitutionIdentityOption: {
    value: '113112',
    meaning: 'Retain Institution Identity Option',
    scheme: 'DCM',
  },
}
