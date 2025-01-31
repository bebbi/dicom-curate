import { TCsvMappings } from './csvMapping'

type TPS315Options = {
  cleanDescriptorsOption: boolean
  retainLongitudinalTemporalInformationOptions: 'Off' | 'Modified' | 'Full'
  retainPatientCharacteristicsOption: boolean
  retainDeviceIdentityOption: boolean
  retainUIDsOption: boolean
  retainSafePrivateOption: boolean
  retainInstitutionIdentityOption: boolean
}

export interface OrganizeOptions {
  inputDirectory: FileSystemDirectoryHandle
  // identical to inputPathPattern.
  filePathPattern: string
  fieldMapping: FileSystemFileHandle
  mappingFunctions: FileSystemFileHandle
  outputDirectory: FileSystemDirectoryHandle
  ps315Options: TPS315Options
}

export type TMappingOptions = {
  fieldMappings: TCsvMappings
  mappingFunctions: string
  inputPathPattern: string
  ps315Options: TPS315Options
}

export type TFileInfo = {
  path: string
  name: string
  size: number
  fileHandle: FileSystemFileHandle
}

export type TMapResults = {
  sourceInstanceUID: string
  outputFilePath: string
  mappings: {
    [objectPath: string]:
      | [string, 'replace', string, string | never[]]
      | [string, 'delete', string, undefined]
  }
  anomalies: string[]
}

export type TPs315EElement = {
  name: string
  tag: string
  stdCompIOD: 'Y' | 'N'
  id: string
  basicProfile: string
  cleanDescOpt?: string
  cleanStructContOpt?: string
  rtnLongFullDatesOpt?: string
  rtnLongModifDatesOpt?: string
  rtnUIDsOpt?: string
  rtnPatCharsOpt?: string
  rtnDevIdOpt?: string
  rtnInstIdOpt?: string
  cleanGraphOpt?: string
  rtnSafePrivOpt?: string
}
