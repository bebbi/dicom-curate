// Polyfill TextEncoder/TextDecoder for Node.js test environment
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = global.TextEncoder || TextEncoder
global.TextDecoder = global.TextDecoder || TextDecoder
