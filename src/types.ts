import { TColumnMappings, TMappedValues, Row } from './csvMapping'
import type { TNaturalData } from 'dcmjs'
import type { SpecPart } from './composeSpecs'

export type Iso8601Duration = string

export type TPs315Options = {
  cleanDescriptorsOption: boolean
  cleanDescriptorsExceptions: false | string[]
  retainLongitudinalTemporalInformationOptions: 'Full' | 'Off' | 'Offset'
  retainPatientCharacteristicsOption: false | string[]
  retainDeviceIdentityOption: boolean
  retainUIDsOption: 'On' | 'Off' | 'Hashed'
  retainSafePrivateOption: 'Off' | 'Quarantine'
  retainInstitutionIdentityOption: boolean
}

export type OrganizeOptions = {
  outputDirectory?: FileSystemDirectoryHandle
  curationSpec: () => TCurationSpecification | SpecPart[]
  table?: Row[]
  skipWrite?: boolean
  skipModifications?: boolean
  skipValidation?: boolean
  dateOffset?: Iso8601Duration
} & (
  | { inputType: 'directory'; inputDirectory: FileSystemDirectoryHandle }
  | { inputType: 'files'; inputFiles: File[] }
)

export type TMappingOptions = {
  columnMappings?: TColumnMappings
  curationSpec: () => TCurationSpecification | SpecPart[]
  skipWrite?: boolean
  skipModifications?: boolean
  skipValidation?: boolean
  dateOffset?: Iso8601Duration
  uidMappings?: Record<string, string>
}

export type TSerializedMappingOptions = Omit<
  TMappingOptions,
  'curationSpec'
> & {
  curationSpecStr: string
}

export type TFileInfo = { path: string; name: string; size: number } & (
  | { kind: 'handle'; fileHandle: FileSystemFileHandle }
  | { kind: 'blob'; blob: Blob }
)

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
  listing?: {
    info: TMappingTwoPassInfo[]
    collectByValue: [...TMappingTwoPassCollect, string | number][]
  }
  mappedBlob?: Blob
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
  getMapping: ((value: string) => string | number) | undefined
  getDicom: (attrName: string) => any
  missingDicom: (attrName: string) => boolean
  protectUid: (uid: string) => string
  addDays: (dicomDateString: string, offsetDays: number) => string
  FILENAME: symbol
  FILEBASENAME: symbol
}

type TMappingInputDirect = {
  // load: csv file
  type: 'load'
  collect: Record<string, RegExp | string[]>
}

type TMappingTwoPassInfo = [name: string, value: string]
type TMappingTwoPassCollect = [
  value: string,
  format: RegExp | string[],
  lookupField: string,
]

type TMappingInputTwoPass = {
  // two-pass: extract from listing.
  type: 'listing'
  collect: (
    parser: Pick<TParser, 'getDicom' | 'getFilePathComp' | 'getFrom'>,
  ) => {
    lookups: { [lookupField: string]: string }
    info: TMappingTwoPassInfo[]
    collect: TMappingTwoPassCollect[]
  }
}

type HPPrimitive = string | number | boolean | null | RegExp
export type HPValue = HPPrimitive | { [k: string]: HPValue } | HPValue[]

export type HostProps = Record<string, HPValue>

export type TCurationSpecification<THost extends HostProps = HostProps> = {
  version: string
  modifyDicomHeader: (parser: TParser) => { [keyword: string]: string }
  outputFilePathComponents: (parser: TParser) => string[]
  errors: (parser: TParser) => [message: string, failure: boolean][]
  dicomPS315EOptions: TPs315Options | 'Off'
  inputPathPattern: string
  hostProps: THost
  additionalData?: { mapping: TMappedValues } & (
    | TMappingInputDirect
    | TMappingInputTwoPass
  )
  excludedFiletypes?: string[]
}

type TProgressMessageBase = {
  totalFiles?: number
  processedFiles?: number
}

type TProgressMessageProgress = TProgressMessageBase & {
  response: 'progress'
  mapResults?: TMapResults
  error?: Error
}

export type TProgressMessageDone = TProgressMessageBase & {
  response: 'done'
  mapResultsList: TMapResults[]
}

export type TProgressMessage = TProgressMessageProgress | TProgressMessageDone
