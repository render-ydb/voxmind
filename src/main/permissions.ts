import { systemPreferences, dialog } from 'electron'

export async function checkPermissions(): Promise<void> {
  // Check microphone permission
  const micStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (micStatus === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
  } else if (micStatus === 'denied') {
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Microphone Permission Required',
      message: 'Please grant microphone access in System Settings > Privacy & Security > Microphone, then restart the app.'
    })
  }

  // Check accessibility permission (needed for text injection)
  const trusted = systemPreferences.isTrustedAccessibilityClient(false)
  if (!trusted) {
    // This triggers the system permission prompt
    systemPreferences.isTrustedAccessibilityClient(true)
  }
}
