import { useState } from 'react'
import { useInstallPrompt } from './useInstallPrompt'
import { useServiceWorker } from './useServiceWorker'

export default function PWAPrompts() {
  const { canInstall, promptInstall } = useInstallPrompt()
  const { updateAvailable, applyUpdate } = useServiceWorker()
  const [installDismissed, setInstallDismissed] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  const showInstall = canInstall && !installDismissed
  const showUpdate = updateAvailable && !updateDismissed

  if (!showInstall && !showUpdate) return null

  return (
    <>
      {showInstall && (
        <div style={bannerStyle}>
          <span>Install Cutlass for a faster, offline-capable experience.</span>
          <div style={btnGroup}>
            <button style={primaryBtn} onClick={promptInstall}>Install</button>
            <button style={dismissBtn} onClick={() => setInstallDismissed(true)}>Not now</button>
          </div>
        </div>
      )}
      {showUpdate && (
        <div style={{ ...bannerStyle, background: '#1b3a4b' }}>
          <span>A new version is available.</span>
          <div style={btnGroup}>
            <button style={primaryBtn} onClick={applyUpdate}>Update now</button>
            <button style={dismissBtn} onClick={() => setUpdateDismissed(true)}>Later</button>
          </div>
        </div>
      )}
    </>
  )
}

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderRadius: 8,
  background: '#2a2a2a',
  color: '#e0e0e0',
  fontSize: 13,
  boxShadow: '0 4px 20px rgba(0,0,0,.5)',
  border: '1px solid #444',
  whiteSpace: 'nowrap',
}

const btnGroup: React.CSSProperties = { display: 'flex', gap: 6 }

const primaryBtn: React.CSSProperties = {
  padding: '5px 14px',
  borderRadius: 4,
  border: 'none',
  background: '#4a9eff',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}

const dismissBtn: React.CSSProperties = {
  padding: '5px 14px',
  borderRadius: 4,
  border: '1px solid #555',
  background: 'transparent',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 13,
}
