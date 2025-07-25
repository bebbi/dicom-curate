import type { TFileInfo } from './types'

// For editor linter to treat the file as an es module, avoiding the error on
// keepScanning being redeclared
export {}

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

self.addEventListener('message', (event) => {
  switch (event.data.request) {
    case 'scan':
      console.log(
        `Starting directory scan of ${event.data.directoryHandle.name}`,
      )
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
