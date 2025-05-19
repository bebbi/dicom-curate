import { extractColumnMappings, TColumnMappings, Row } from './csvMapping'
import { clearCaches } from './clearCaches'
import type {
  TMappingOptions,
  TMapResults,
  TFileInfo,
  OrganizeOptions,
  TProgressMessage,
  TCurationSpecification,
  TMoveTemporalInformation,
} from './types'
import type { TMappedValues } from './csvMapping'

type TMappingWorkerOptions = TMappingOptions & {
  outputDirectory: FileSystemDirectoryHandle
}

export type ProgressCallback = (message: TProgressMessage) => void

export type {
  TPs315Options,
  TMapResults,
  TProgressMessage,
  OrganizeOptions,
  TCurationSpecification,
} from './types'

export { specVersion } from './config/specVersion'
export { sampleSpecification } from './config/sampleSpecification'
export { csvTextToRows } from './csvMapping'
export type { Row } from './csvMapping'

const mappingWorkerCount = navigator.hardwareConcurrency

let filesToProcess: TFileInfo[] = []
let directoryScanFinished = false

function toDeidMap(deIdOptions: TMoveTemporalInformation): TMappedValues {
  const [source, identifier, fromHeader, toHeader] = deIdOptions
  return {
    [toHeader]: {
      value: (parser) => parser.getFrom(source, identifier),
      lookup: (row) => row[fromHeader],
      replace: (row) => row[toHeader],
    },
  }
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

  fileListWorker.addEventListener('message', (event) => {
    switch (event.data.response) {
      case 'file':
        filesToProcess.push(event.data.fileInfo)
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
        console.error(`Unknown response from worker ${event.data.response}`)
    }
    dispatchMappingJobs()
  })

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
          if (progressCallback) {
            progressCallback({
              response: 'progress',
              mapResults: event.data.mapResults,
              processedFiles: mapResultsList.length,
              totalFiles:
                filesToProcess.length + mapResultsList.length + workersActive,
            })
          }

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
    const fileInfo = filesToProcess.pop()!
    const mappingWorker = availableMappingWorkers.pop()!
    const { outputDirectory, ...mappingOptions } = mappingWorkerOptions
    mappingWorker.postMessage({
      request: 'apply',
      fileInfo,
      outputDirectory,
      mappingOptions,
    })
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

  // FIXME: stop eval once spec is a real function
  let curationSpecification: () => Partial<TCurationSpecification> = () => ({})
  eval(curationSpec)
  const spec = curationSpecification()

  const deId = spec.dicomPS315EOptions
  const hasDeIdMap =
    deId !== 'Off' &&
    Array.isArray(deId?.retainLongitudinalTemporalInformationOptions)

  //
  // then, get the field mappings from the csv file
  //
  // assumes all fields are not repeated across rows
  let columnMappings: TColumnMappings | undefined
  if (organizeOptions.table && (spec.additionalData || hasDeIdMap)) {
    const fullMap = Object.assign(
      {},
      spec.additionalData?.mapping,
      hasDeIdMap &&
        toDeidMap(
          // Type cast because of hasDeIdMap check
          deId.retainLongitudinalTemporalInformationOptions as TMoveTemporalInformation,
        ),
    )
    columnMappings = extractColumnMappings(organizeOptions.table, fullMap)
  }

  const skipWrite = organizeOptions.skipWrite ?? false

  return { outputDirectory, columnMappings, curationSpec, skipWrite }
}

function queueFilesForMapping(organizeOptions: OrganizeOptions) {
  organizeOptions.inputFiles.forEach((inputFile) => {
    const fileInfo: TFileInfo = {
      path: '',
      name: inputFile.name,
      size: inputFile.size,
      fileHandle: undefined,
      // a File is a Blob
      blob: inputFile,
    }
    filesToProcess.push(fileInfo)
    dispatchMappingJobs()
  })
}

let progressCallback: ProgressCallback | undefined

async function apply(
  organizeOptions: OrganizeOptions,
  onProgress?: ProgressCallback,
) {
  progressCallback = onProgress

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
  if (organizeOptions.inputDirectory) {
    const fileListWorker = initializeFileListWorker()
    fileListWorker.postMessage({
      request: 'scan',
      directoryHandle: organizeOptions.inputDirectory,
    })
  } else if (organizeOptions.inputFiles) {
    queueFilesForMapping(organizeOptions)
  } else {
    console.error('Need either inputFiles or inputDirectory')
  }
  dispatchMappingJobs()
}

export { apply }
