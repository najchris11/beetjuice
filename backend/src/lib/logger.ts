function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function write(level: string, msg: string, stream = process.stdout): void {
  stream.write(`[${ts()}] ${level}  ${msg}\n`)
}

export const logger = {
  info:  (msg: string) => write('INFO ', msg),
  warn:  (msg: string) => write('WARN ', msg),
  error: (msg: string) => write('ERROR', msg, process.stderr),
}
