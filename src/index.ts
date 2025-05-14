import { extractColumnMappings, TColumnMappings, Row } from './csvMapping'
import { clearCaches } from './clearCaches'
import { resetCounts } from './UniqueNumbers'
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
let isSkipWriteMode = false // Track if we're in skipWrite mode
let totalFilesFound = 0 // Keep track of total files found during scanning

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
  totalFilesFound = 0 // Reset total files counter

  const fileListWorker = new Worker(
    new URL('./scanDirectoryWorker.js', import.meta.url),
    { type: 'module' },
  )

  fileListWorker.addEventListener('message', (event) => {
    switch (event.data.response) {
      case 'file':
        filesToProcess.push(event.data.fileInfo)
        totalFilesFound++ // Increment the total file count
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

          // Report progress differently depending on skipWrite mode
          if (progressCallback) {
            // In skipWrite mode (collection phase), we don't care about processed file counts
            // We just want to send the mapping results for patient data extraction
            if (isSkipWriteMode) {
              progressCallback({
                response: 'progress',
                mapResults: event.data.mapResults,
                // Don't send file counts in collection phase
                processedFiles: 0,
                totalFiles: 0,
              })
            } else {
              // In normal mode (processing phase), send file counts
              // Ensure totalFiles doesn't change during processing to avoid progress going over 100%
              const calculatedTotal = Math.max(
                totalFilesFound,
                mapResultsList.length + workersActive + filesToProcess.length,
              )
              progressCallback({
                response: 'progress',
                mapResults: event.data.mapResults,
                processedFiles: Math.min(
                  mapResultsList.length,
                  calculatedTotal,
                ),
                totalFiles: calculatedTotal,
              })
            }
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

// Reset all progress-related variables and counters
function resetProgress() {
  // Reset worker tracking
  filesToProcess = []
  directoryScanFinished = false
  workersActive = 0
  mapResultsList = []
  totalFilesFound = 0 // Reset total file count

  // Clear worker options
  mappingWorkerOptions = {}

  // Terminate and remove any existing workers
  while (availableMappingWorkers.length) {
    const worker = availableMappingWorkers.pop()
    if (worker) {
      worker.terminate()
    }
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
    console.log(mapResultsList)

    // Send a final completion signal if in skipWrite mode
    // This helps the UI know when to extract patient data
    if (isSkipWriteMode && progressCallback) {
      progressCallback({
        response: 'progress',
        processedFiles: mapResultsList.length,
        totalFiles: mapResultsList.length, // Equal numbers indicate completion
        mapResults:
          mapResultsList.length > 0
            ? mapResultsList[mapResultsList.length - 1]
            : undefined,
      })
    } else if (progressCallback) {
      // Send final progress with guaranteed 100% completion
      progressCallback({
        response: 'progress',
        processedFiles: totalFilesFound,
        totalFiles: totalFilesFound,
        mapResults:
          mapResultsList.length > 0
            ? mapResultsList[mapResultsList.length - 1]
            : undefined,
      })
    }
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

let progressCallback: ProgressCallback | undefined

async function apply(
  organizeOptions: OrganizeOptions,
  onProgress?: ProgressCallback,
) {
  // Reset all counters to ensure clean state
  resetCounts()

  // Track if we're in skipWrite mode
  isSkipWriteMode = organizeOptions.skipWrite ?? false

  progressCallback = onProgress

  const fileListWorker = initializeFileListWorker()
  initializeMappingWorkers()
  // Set global mappingWorkerOptions
  mappingWorkerOptions = (await collectMappingOptions(
    organizeOptions,
  )) as TMappingWorkerOptions
  fileListWorker.postMessage({
    request: 'scan',
    directoryHandle: organizeOptions.inputDirectory,
  })
  dispatchMappingJobs()
}

export { apply }
