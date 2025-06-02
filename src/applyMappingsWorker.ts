import { curateFile } from './curateFile'

declare var self: Window & typeof globalThis

self.addEventListener('message', (event) => {
  switch (event.data.request) {
    case 'apply':
      try {
        curateFile(
          event.data.fileInfo,
          event.data.outputDirectory,
          event.data.mappingOptions,
        ).then((mapResults) => {
          // Send finished message for completion
          self.postMessage({
            response: 'finished',
            mapResults: mapResults,
          })
        })
      } catch (error) {
        self.postMessage({ response: 'error', error })
        throw new Error('ERROR')
      }
      break
    default:
      console.error(`Unknown request ${event.data.request}`)
  }
})
