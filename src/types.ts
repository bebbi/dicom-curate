import { TColumnMappings } from './csvMapping'
import { TNaturalData } from 'dcmjs'

export type TPs315Options = {
  cleanDescriptorsOption: boolean
  cleanDescriptorsExceptions: string[]
  retainLongitudinalTemporalInformationOptions:
    | 'Full'
    | 'Off'
    | [
        'dicom' | 'filePath',
        identifier: string,
        fromHeader: string,
        toHeader: string,
      ]
  retainPatientCharacteristicsOption: false | string[]
  retainDeviceIdentityOption: boolean
  retainUIDsOption: 'On' | 'Off' | 'Hashed'
  retainSafePrivateOption: 'Off' | 'Quarantine'
  retainInstitutionIdentityOption: boolean
}

export interface OrganizeOptions {
  inputDirectory: FileSystemDirectoryHandle
  outputDirectory: FileSystemDirectoryHandle
  curationSpec: string
  // Fixme: Improve columnMapping (file) vs columnMappings (object) naming
  columnMapping?: FileSystemFileHandle
}

export type TMappingOptions = {
  columnMappings?: TColumnMappings
  curationSpec: string
}

export type TFileInfo = {
  path: string
  name: string
  size: number
  fileHandle: FileSystemFileHandle
}

// Includes deep sequences
type TAttr = { [name: string]: string | TAttr[] }

export type TMapResults = {
  sourceInstanceUID: string
  outputFilePath: string
  mappings: {
    // objectpath: deep object access string compatible with lodash get/set
    // TAttr[]: exclude individual { key: value } objects
    [objectPath: string]:
      | [string, 'replace', string, string | TAttr[]]
      | [string, 'delete', string, undefined]
  }
  anomalies: string[]
  errors: string[]
  quarantine: { [objectPath: string]: string }
}

export type TPs315EElement = {
  name: string
  keyword: string
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
  // introduced by us
  exceptCondition?: (attrs: TNaturalData) => boolean
}

export type TParser = {
  isUniqueInGroup: (value: string | number, groupId: string) => boolean
  getUniqueNumberInGroup: (groupingId: string) => string
  getFrom(source: string, identifier: string): string | number
  getFilePathComp: (component: string | number | symbol) => string
  getMapping:
    | ((
        value: string | number,
        fromColumn: string,
        toColumn: string,
      ) => string | number)
    | undefined
  getDicom: (attrName: string) => any
  missingDicom: (attrName: string) => boolean
  addDays: (dicomDateString: string, offsetDays: number) => string
  FILENAME: symbol
  FILEBASENAME: symbol
}

export type TMappingSpecification = {
  version: string
  modifications: (parser: TParser) => {
    dicomHeader: { [keyword: string]: string }
    outputFilePathComponents: string[]
  }
  validation: (parser: TParser) => {
    errors: [message: string, failure: boolean][]
  }
  dicomPS315EOptions: TPs315Options | 'Off'
  inputPathPattern: string
  // These 2 are not used in code but added to maintain consistency in
  // mappingSpec file (no const keywords)
  identifiers: Record<string, any>
  mappingCsvHeaders: Record<string, any>
}

export type TProgressMessage = {
  response: 'start' | 'progress' | 'finished' | 'error'
  totalFiles?: number
  processedFiles?: number
  mapResults?: TMapResults
  error?: Error
}
