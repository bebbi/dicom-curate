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

async function scanDirectory(dir) {
  async function traverse(dir, prefix) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile()
        self.postMessage({
          response: 'file',
          fileInfo: {
            path: prefix,
            name: entry.name,
            size: file.size,
            fileHandle: entry,
          },
        })
      } else if (entry.kind === 'directory') {
        if (keepScanning) {
          await traverse(entry, prefix + '/' + entry.name)
        }
      }
    }
  }

  await traverse(dir, dir.name)
  self.postMessage({ response: 'done' })
  self.close()
}
