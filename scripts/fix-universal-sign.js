// Re-sign the universal .app after @electron/universal merges arm64 + x64.
// electron-builder's "afterPack" fires per-arch (too early for universal).
// "afterSign" fires after the universal merge — perfect timing.

import { execSync } from 'child_process'
import { join } from 'path'

export default async function (context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  console.log(`[fix-universal-sign] Re-signing: ${appPath}`)

  execSync(
    `codesign --force --deep --sign - "${appPath}"`,
    { stdio: 'inherit' }
  )
  console.log('[fix-universal-sign] Re-signing complete')
}
