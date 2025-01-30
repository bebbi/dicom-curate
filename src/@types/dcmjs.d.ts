/*
 * Handle with care, mostly AI generated and probably with some errors
 */
declare module 'dcmjs' {
  // Bug where it can be undefined too.
  export type TDicomDataValue = any[]
  export type TDicomDataEntry = { Value: TDicomDataValue; vr: string }
  export type TNaturalData = Record<string, any>
  export type TDicomData = {
    meta: { [hex: string]: TDicomDataEntry }
    dict: { [hex: string]: TDicomDataEntry }
  }

  export namespace data {
    class DicomMetaDictionary {
      static nameMap: Record<string, any>
      static getTagFromName(name: string): string
      static getNameFromTag(tag: string): string
      static getVR(tag: string): string
      static getDescription(tag: string): string
      static getVM(tag: string): string
      static getKeyword(tag: string): string
      static naturalizeDataset(
        dataset: Record<string, TDicomDataEntry>,
      ): TNaturalData
      static denaturalizeDataset(dataset: TNaturalData): TDicomData
    }
  }

  export namespace dicom {
    class Dataset {
      constructor(data?: Record<string, TDicomDataEntry>)
      elements: Record<string, TDicomDataEntry>
      getElement(tag: string): TDicomDataEntry | undefined
      setElement(tag: string, value: TDicomDataEntry): void
    }

    class DicomDict {
      constructor()
      dataset: Dataset
      dumpToConsole(): void
      merge(other: DicomDict): void
    }
  }

  export namespace utilities {
    class DicomMessage {
      constructor(arrayBuffer: ArrayBuffer)
      static read(arrayBuffer: ArrayBuffer): DicomMessage
      static readFile(fileArrayBuffer: ArrayBuffer): {
        meta: Record<string, TDicomDataEntry>
        dict: Record<string, TDicomDataEntry>
      }
      toJSON(): object
      getElement(tag: string): TDicomDataEntry | undefined
    }
  }

  export namespace adapters {
    class Cornerstone {
      static imageIdToDataset(imageId: string): Promise<any>
    }
  }

  export namespace normalizers {
    class Normalizer {
      static normalizeToDataset(data: any): any
    }
  }

  export namespace tools {
    class TID300 {
      static toStructuredReport(dataset: any): object
    }
  }
}
