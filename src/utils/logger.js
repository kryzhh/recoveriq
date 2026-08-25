const levels = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', success: '[SUCCESS]' }

export const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : ''),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? meta : ''),
  error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, Object.keys(meta).length ? meta : ''),
  success: (msg, meta = {}) => console.log(`[OK] ${msg}`, Object.keys(meta).length ? meta : ''),
}

export default logger