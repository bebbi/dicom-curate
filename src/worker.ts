let wt: typeof import('worker_threads') | null = null

// Lazy initialization for Node.js worker_threads
async function initializeNodeWorker() {
  if (!wt) {
    wt = await import('worker_threads')
  }
  return wt
}

// Factory function to create workers in both browser and Node.js environments
export async function createWorker(
  scriptPath: string | URL,
  options?: any,
): Promise<Worker> {
  if (typeof Worker !== 'undefined') {
    // Browser environment
    return new Worker(scriptPath, options)
  } else {
    // Node.js environment
    const workerThreads = await initializeNodeWorker()

    // The types aren't entirely compatible, but they are close enough for our use case.
    // We add an 'addEventListener' method to mimic the browser Worker interface.
    const worker = new workerThreads!.Worker(scriptPath, options as any) as any

    worker['addEventListener'] = function (event: any, listener: any) {
      this.on(event, listener)
    }

    return worker as Worker
  }
}

// Maps over the differences between browser and Node.js worker environments
// No-op in browser
export async function fixupNodeWorkerEnvironment() {
  if (typeof Worker === 'undefined') {
    // Only needed in Node.js
    const workerThreads = await initializeNodeWorker()

    globalThis.addEventListener = function (event: any, listener: any) {
      workerThreads!.parentPort?.addEventListener(event, listener)
    }

    globalThis.postMessage = function (data: any, transferList?: any) {
      workerThreads!.parentPort?.postMessage({ data }, transferList)
    }

    globalThis.close = function () {
      workerThreads!.parentPort?.close()
    }
  }
}
