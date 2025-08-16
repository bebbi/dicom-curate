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
  }
  | {
    response: 'done'
  }

declare const self: Window & typeof globalThis

let keepScanning = true
let excludedFiletypes: string[] = []

/**
 * Check if a file should be processed based on filtering rules
 * @param file - The file to check
 * @returns Promise<boolean> - True if the file should be processed
 */
async function shouldProcessFile(file: File): Promise<boolean> {
  const allExcludedFiletypes = [
    ...DEFAULT_EXCLUDED_FILETYPES,
    ...excludedFiletypes
  ]

  try {
    // Check if the file is in the list of excluded files
    if (allExcludedFiletypes.some(excluded => file.name.toLowerCase() === excluded.toLowerCase())) {
      console.log(`[dicom-curate] Skipping excluded file: ${file.name}`)
      return false
    }

    // Check filesize - (valid) DICOM files are at least 132 bytes (128-byte preamble + 4-byte signature)
    if (file.size < 132) {
      console.log(`[dicom-curate] Skipping very small file: ${file.name} (${file.size} bytes)`)
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
    console.log(`[dicom-curate] Skipping file without DICOM signature: ${file.name}`)
    return false

  } catch (error) {
    console.warn(`[dicom-curate] Error checking file ${file.name}, allowing parser to decide:`, error)
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

    for await (const entry of dir.values()) {
      entries.push(entry)
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    // Assign sorted index to files
    let fileIndex = 0

    for (const entry of entries) {
      if (entry.kind === 'file' && keepScanning) {
        const file = await (entry as FileSystemFileHandle).getFile()

        if (await shouldProcessFile(file)) {
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
