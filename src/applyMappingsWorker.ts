import { curateFile } from './curateFile'
import { deserializeMappingOptions } from './serializeMappingOptions'

declare var self: Window & typeof globalThis

self.addEventListener('message', (event) => {
  switch (event.data.request) {
    case 'apply':
      const { serializedMappingOptions } = event.data
      const mappingOptions = deserializeMappingOptions(serializedMappingOptions)

      try {
        curateFile(
          event.data.fileInfo,
          event.data.outputDirectory,
          mappingOptions,
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
