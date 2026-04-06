import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export default async function setupVitest() {
  await execFileAsync(process.execPath, ['scripts/generate-route-tree.mjs'], {
    cwd: process.cwd(),
    env: process.env,
  })
}
