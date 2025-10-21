import type { TFileInfo } from './types'

// For editor linter to treat the file as an es module, avoiding the error on
// keepScanning being redeclared
export { }

// Case-insensitive filetypes to ALWAYS exclude from processing
const DEFAULT_EXCLUDED_FILETYPES = ['dicomdir', 'dicomdir.dir', 'dicomdir.dat', 'dicomdir.bak', 'thumbs.db', '.ds_store']

export type FileScanMsg =
  | {
    response: 'file'
    fileIndex: number
    fileInfo: TFileInfo
    previousFileInfo?: { size?: number; mtime?: string; preMappedHash?: string }
  }
  | {
    response: 'scanAnomalies'
    fileIndex: number
    fileInfo: TFileInfo
    anomalies: string[]
    previousFileInfo?: { size?: number; mtime?: string; preMappedHash?: string }
  }
  | {
    response: 'done'
  }

declare const self: Window & typeof globalThis

let keepScanning = true
let excludedFiletypes: string[] = []
// optional map of previous file info keyed by "path/name"
let previousIndex: Record<string, { size?: number; mtime?: string }> | undefined

/**
 * Check if a file should be processed based on filtering rules
 * @param file - The file to check
 * @param fileAnomalies - Array to collect anomalies for this specific file e.g. excluded files
 * @returns Promise<boolean> - True if the file should be processed
 */
async function shouldProcessFile(file: File, fileAnomalies: string[]): Promise<boolean> {
  const allExcludedFiletypes = [
    ...DEFAULT_EXCLUDED_FILETYPES,
    ...excludedFiletypes
  ]

  try {
    // Check if the file is in the list of excluded files
    if (allExcludedFiletypes.some(excluded => file.name.toLowerCase() === excluded.toLowerCase())) {
      fileAnomalies.push(`Skipped excluded file: ${file.name}`)
      return false
    }

    // Check filesize - (valid) DICOM files are at least 132 bytes (128-byte preamble + 4-byte signature)
    if (file.size < 132) {
      fileAnomalies.push(`Skipped very small file: ${file.name} (${file.size} bytes)`)
      return false
    }

    // Check for DICOM signature "DICM" at offset 128
    const headerBytes = await file.slice(128, 132).arrayBuffer()
    const headerView = new Uint8Array(headerBytes)
    const dicomSignature = String.fromCharCode(headerView[0], headerView[1], headerView[2], headerView[3])
    if (dicomSignature === 'DICM') {
      return true
    }

    // Don't parse file without DICOM signature
    fileAnomalies.push(`Skipped file without DICOM signature: ${file.name}`)
    return false

  } catch (error) {
    fileAnomalies.push(`Unable to determine file validity - processing anyway: ${file.name} - ${error}`)
    // If vetting process fails, let the parser decide
    return true
  }
}

self.addEventListener('message', (event) => {
  switch (event.data.request) {
    case 'scan':
      console.log(
        `Starting directory scan of ${event.data.directoryHandle.name}`,
      )
      // Optional previous file info index passed in by caller
      if (event.data.fileInfoIndex) {
        previousIndex = event.data.fileInfoIndex
      } else {
        previousIndex = undefined
      }
      // Update excluded filetypes if provided
      if (event.data.excludedFiletypes) {
        excludedFiletypes = event.data.excludedFiletypes
      }
      keepScanning = true
      scanDirectory(event.data.directoryHandle)
      break
    case 'stop':
      keepScanning = false
      break
    default:
      console.error(`Unknown request ${event.data.request}`)
  }
})

async function scanDirectory(dir: FileSystemDirectoryHandle) {
  async function traverse(dir: FileSystemDirectoryHandle, prefix: string) {
    // First, collect sorted dir entries
    const entries = []

    console.log("scanning...")
    console.log(dir.name)

    for await (const entry of dir.values()) {
      entries.push(entry)
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    // Assign sorted index to files
    let fileIndex = 0

    for (const entry of entries) {
      if (entry.kind === 'file' && keepScanning) {
        const file = await (entry as FileSystemFileHandle).getFile()
        const fileAnomalies: string[] = []

        if (await shouldProcessFile(file, fileAnomalies)) {
          // Send file to processing pipeline
            const key = `${prefix}/${entry.name}`
            const prev = previousIndex ? previousIndex[key] : undefined
            self.postMessage({
              response: 'file',
              fileIndex: fileIndex++,
              fileInfo: {
                path: prefix,
                name: entry.name,
                size: file.size,
                kind: 'handle',
                fileHandle: entry as FileSystemFileHandle,
              },
              previousFileInfo: prev,
            } satisfies FileScanMsg)
        } else if (fileAnomalies.length > 0) {
          // Send scan anomalies as separate messsage so they are not sent to processing (curate)
            const key = `${prefix}/${entry.name}`
            const prev = previousIndex ? previousIndex[key] : undefined
            self.postMessage({
              response: 'scanAnomalies',
              fileIndex: fileIndex++,
              fileInfo: {
                path: prefix,
                name: entry.name,
                size: file.size,
                kind: 'handle',
                fileHandle: entry as FileSystemFileHandle,
              },
              anomalies: fileAnomalies,
              previousFileInfo: prev,
            } satisfies FileScanMsg)
        }
      } else if (entry.kind === 'directory' && keepScanning) {
        await traverse(
          entry as FileSystemDirectoryHandle,
          prefix + '/' + entry.name,
        )
      }
    }
  }

  await traverse(dir, dir.name)
  self.postMessage({ response: 'done' } satisfies FileScanMsg)
  self.close()
}
