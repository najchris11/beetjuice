function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export const logger = {
  info:  (msg: string) => process.stdout.write(`[${ts()}] INFO   ${msg}\n`),
  warn:  (msg: string) => process.stdout.write(`[${ts()}] WARN   ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[${ts()}] ERROR  ${msg}\n`),
}
