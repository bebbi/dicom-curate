declare module 'dcmjs' {
  export type TDicomDataValue = any[]
  export type TDicomDataEntry = { Value: TDicomDataValue; vr: string }
  export type TDicomDataDict = { [hex: string]: TDicomDataEntry }

  export type TNaturalData = { [keyword: string]: any }
  export type TDicomData = {
    meta: TDicomDataDict
    dict: TDicomDataDict
  }
  export type TDicomDictionaryEntry = {
    tag: string // e.g., "00100010"
    vr: string // e.g., "PN"
    vm: string // e.g., "1"
    name: string // e.g., "PatientName"
    version: string
  }
  export type TDicomDictionary = {
    [tag: string]: TDicomDictionaryEntry
  }

  export namespace data {
    class DicomDict {
      constructor(meta: TDicomDataDict)
      meta: TDicomDataDict
      dict: TDicomDataDict
      write(): ArrayBuffer
      merge(other: DicomDict): void
    }

    class DicomMessage {
      constructor(arrayBuffer: ArrayBuffer)
      static readFile(fileArrayBuffer: ArrayBuffer): DicomDict
    }

    class DicomMetaDictionary {
      static nameMap: {
        [keyWord: string]: {
          tag: string
          vr: string
          name: string
          vm: string
          version: string
        }
      }
      static dictionary: TDicomDictionary
      static getTagFromName(name: string): string
      static getNameFromTag(tag: string): string
      static getVR(tag: string): string
      static getDescription(tag: string): string
      static getVM(tag: string): string
      static getKeyword(tag: string): string
      static naturalizeDataset(
        dataset: Record<string, TDicomDataEntry>,
      ): TNaturalData
      static denaturalizeDataset(
        dataset: TNaturalData,
      ): Record<string, TDicomDataEntry>
    }

    function datasetToDict(dataset: Dataset): Record<string, TDicomDataEntry>
    function datasetToBuffer(dataset: Dataset): ArrayBuffer
    function datasetToBlob(dataset: Dataset): Blob
  }

  export namespace log {
    /**
     * Sets the global logging level.
     * @param level - The desired logging level.
     */
    function setLevel(level: LogLevel): void

    /**
     * Retrieves a logger instance by name.
     * @param name - The name of the logger.
     * @returns A logger instance.
     */
    function getLogger(name: string): Logger

    /**
     * Enumeration of available log levels.
     */
    const levels: {
      TRACE: LogLevel
      DEBUG: LogLevel
      INFO: LogLevel
      WARN: LogLevel
      ERROR: LogLevel
      SILENT: LogLevel
    }
  }

  /**
   * Represents a logger with methods for various logging levels.
   */
  export interface Logger {
    setLevel(level: LogLevel): void
    trace(...msg: any[]): void
    debug(...msg: any[]): void
    info(...msg: any[]): void
    warn(...msg: any[]): void
    error(...msg: any[]): void
  }

  /**
   * Type representing the possible log levels.
   */
  export type LogLevel =
    | 'trace'
    | 'debug'
    | 'info'
    | 'warn'
    | 'error'
    | 'silent'
}
