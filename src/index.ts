import { extractColumnMappings, TColumnMappings } from './csvMapping'
import { clearCaches } from './clearCaches'
import { curateOne } from './curateOne'
import { serializeMappingOptions } from './serializeMappingOptions'
import { iso8601 } from './offsetDateTime'

import type {
  TMappingOptions,
  TMapResults,
  TFileInfo,
  OrganizeOptions,
  TProgressMessage,
  TProgressMessageDone,
  TPs315Options,
} from './types'

import type { FileScanMsg } from './scanDirectoryWorker'
import type { MappingRequest } from './applyMappingsWorker'

type TMappingWorkerOptions = TMappingOptions & {
  outputDirectory?: FileSystemDirectoryHandle
}

export type ProgressCallback = (message: TProgressMessage) => void

export type {
  TPs315Options,
  TMapResults,
  TProgressMessage,
  OrganizeOptions,
  TCurationSpecification,
} from './types'

export { TCurateOneArgs } from './curateOne'

export { specVersion } from './config/specVersion'
export { sample2PassCurationSpecification as sampleSpecification } from './config/sample2PassCurationSpecification'
export { csvTextToRows } from './csvMapping'
export type { Row } from './csvMapping'

const mappingWorkerCount = navigator.hardwareConcurrency

let filesToProcess: { fileInfo: TFileInfo; fileIndex: number }[] = []
let directoryScanFinished = false

function requiresDateOffset(
  deIdOpts: TPs315Options | 'Off',
): deIdOpts is TPs315Options & {
  retainLongitudinalTemporalInformationOptions: 'Offset'
} {
  return (
    deIdOpts !== 'Off' &&
    deIdOpts.retainLongitudinalTemporalInformationOptions === 'Offset'
  )
}

/*
 * Directory scanner web worker management
 *
 * worker accepts these messages:
 *   command: 'scan', directoryHandle
 *   command: 'stop'
 * worker sends these messages:
 *   response: 'file', file info (TFileInfo)
 *   response: 'done'
 */
// TODO: implement a buffering stream to request fileHandles in batches
function initializeFileListWorker() {
  filesToProcess = []
  directoryScanFinished = false

  const fileListWorker = new Worker(
    new URL('./scanDirectoryWorker.js', import.meta.url),
    { type: 'module' },
  )

  fileListWorker.addEventListener(
    'message',
    (event: MessageEvent<FileScanMsg>) => {
      switch (event.data.response) {
        case 'file':
          const { fileIndex, fileInfo } = event.data
          filesToProcess.push({ fileIndex, fileInfo })
          // Could do some throttling:
          // if (filesToProcess.length > 10) {
          //   fileListWorker.postMessage({ request: 'stop' })
          // }
          dispatchMappingJobs()
          break
        case 'done':
          console.log('directoryScanFinished')
          directoryScanFinished = true
          break
        default:
          // @ts-expect-error: response is string here, not never
          console.error(`Unknown response from worker ${event.data.response}`)
      }
      dispatchMappingJobs()
    },
  )

  return fileListWorker
}

//
// Apply mappings web worker management
//
// worker accepts these messages:
//   request: 'apply', fileInfo, outDirectoryHandle, mappingOptions
// worker sends these messages:
//   response: 'finished', mapResults
//
let mappingWorkerOptions: Partial<TMappingWorkerOptions> = {} // TODO: only send to worker once
const availableMappingWorkers: Worker[] = []
let workersActive = 0
let mapResultsList: TMapResults[] = []

function initializeMappingWorkers() {
  mappingWorkerOptions = {}
  workersActive = 0
  mapResultsList = []

  for (let workerIndex = 0; workerIndex < mappingWorkerCount; workerIndex++) {
    let mappingWorker = new Worker(
      new URL('./applyMappingsWorker.js', import.meta.url),
      { type: 'module' },
    )
    mappingWorker.onerror = console.error

    /* eslint-disable no-loop-func */
    mappingWorker.addEventListener('message', (event) => {
      switch (event.data.response) {
        case 'finished':
          availableMappingWorkers.push(mappingWorker)
          mapResultsList.push(event.data.mapResults)
          workersActive -= 1

          // Report progress
          progressCallback({
            response: 'progress',
            mapResults: event.data.mapResults,
            processedFiles: mapResultsList.length,
            totalFiles:
              filesToProcess.length + mapResultsList.length + workersActive,
          })

          dispatchMappingJobs()
          if (mapResultsList.length % 100 === 0) {
            console.log(`Finished mapping ${mapResultsList.length} files`)
          }
          break
        default:
          console.error(`Unknown response from worker ${event.data.response}`)
      }
    })
    /* eslint-enable no-loop-func */

    availableMappingWorkers.push(mappingWorker)
  }
}

function dispatchMappingJobs() {
  while (filesToProcess.length > 0 && availableMappingWorkers.length > 0) {
    const { fileInfo, fileIndex } = filesToProcess.pop()!
    const mappingWorker = availableMappingWorkers.pop()!
    const { outputDirectory, ...mappingOptions } =
      // Not partial anymore.
      mappingWorkerOptions as TMappingWorkerOptions
    mappingWorker.postMessage({
      request: 'apply',
      fileInfo,
      fileIndex,
      outputDirectory,
      serializedMappingOptions: serializeMappingOptions(mappingOptions),
    } satisfies MappingRequest)
    workersActive += 1
  }
  if (
    workersActive === 0 &&
    directoryScanFinished &&
    filesToProcess.length === 0
  ) {
    // End and remove all workers
    while (availableMappingWorkers.length) {
      availableMappingWorkers.pop()!.terminate()
    }

    clearCaches()
    console.log(`Finished mapping ${mapResultsList.length} files`)
    console.log('job is finished')

    progressCallback({
      response: 'done',
      mapResultsList: mapResultsList,
      processedFiles: mapResultsList.length,
      totalFiles: mapResultsList.length,
    })
  }
}

async function collectMappingOptions(
  organizeOptions: OrganizeOptions,
): Promise<TMappingWorkerOptions> {
  //
  // first, get the folder mappings and set output directory
  //
  const outputDirectory = organizeOptions.outputDirectory

  //
  // then, get the mapping functions
  //
  const curationSpec = organizeOptions.curationSpec

  const { dicomPS315EOptions: deIdOpts, additionalData } = curationSpec()

  // Parse the column mappings if the spec requires them and they exist.
  // The need for mapping can come from additionalData or from the
  // retainLongitudinalTemporalInformationOptions option
  let columnMappings: TColumnMappings | undefined
  if (organizeOptions.table && additionalData) {
    columnMappings = extractColumnMappings(
      organizeOptions.table,
      additionalData.mapping,
    )
  }

  const skipWrite = organizeOptions.skipWrite ?? false
  const skipModifications = organizeOptions.skipModifications ?? false
  const skipValidation = organizeOptions.skipValidation ?? false

  const dateOffset = organizeOptions.dateOffset

  if (requiresDateOffset(deIdOpts) && !dateOffset?.match(iso8601)) {
    throw new Error(
      'When using "Offset" for retainLongitudinalTemporalInformationOptions, an iso8601 compatible dateOffset must be provided.',
    )
  }

  return {
    outputDirectory,
    columnMappings,
    curationSpec,
    skipWrite,
    skipModifications,
    skipValidation,
    dateOffset,
  }
}

function queueFilesForMapping(
  organizeOptions: Extract<OrganizeOptions, { inputType: 'files' }>,
) {
  organizeOptions.inputFiles.forEach((inputFile, fileIndex) => {
    const fileInfo: TFileInfo = {
      path: '',
      name: inputFile.name,
      size: inputFile.size,
      kind: 'blob',
      blob: inputFile,
    }
    filesToProcess.push({ fileInfo, fileIndex })
    dispatchMappingJobs()
  })
}

let progressCallback: ProgressCallback

async function curateMany(
  organizeOptions: OrganizeOptions,
  onProgress?: ProgressCallback,
): Promise<TProgressMessageDone> {
  return new Promise<TProgressMessageDone>(async (resolve, reject) => {
    // Resolve promise if progressCallback gets called with 'done'
    progressCallback = (msg) => {
      onProgress?.(msg)

      if (msg.response === 'done') {
        resolve(msg)
      }
    }

    try {
      // create the mapping workers
      initializeMappingWorkers()

      // Set global mappingWorkerOptions
      mappingWorkerOptions = (await collectMappingOptions(
        organizeOptions,
      )) as TMappingWorkerOptions

      //
      // If the request provides a directory, then use the worker
      // to recursively convert to fileSystemHandles.
      // If the request provides a list of File objects,
      // send them to the mapping workers directly.
      //
      if (organizeOptions.inputType === 'directory') {
        const fileListWorker = initializeFileListWorker()
        fileListWorker.postMessage({
          request: 'scan',
          directoryHandle: organizeOptions.inputDirectory,
        })
      } else if (organizeOptions.inputType === 'files') {
        queueFilesForMapping(organizeOptions)
      } else {
        console.error('`inputType` should be "directory" or "files"')
      }
      dispatchMappingJobs()
    } catch (error) {
      reject(error)
    }
  })
}

export { curateMany, curateOne, extractColumnMappings, clearCaches }
