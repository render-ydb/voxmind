import React, { useState, useEffect, useRef } from 'react'
import { useAudioCapture } from '../hooks/useAudioCapture.js'
import '../styles/ball.css'

type AppState = 'idle' | 'recording' | 'processing' | 'downloading'

declare global {
  interface Window {
    electronAPI: {
      startRecording: () => void
      stopRecording: () => void
      sendAudioChunk: (chunk: Float32Array) => void
      onStateChange: (cb: (state: string) => void) => () => void
      onTranscription: (cb: (text: string) => void) => () => void
      onPartialResult: (cb: (text: string) => void) => () => void
      onShortcutToggle: (cb: (action: string) => void) => () => void
      startDrag: (x: number, y: number) => void
      dragging: (dx: number, dy: number) => void
      saveTargetApp: () => void
    }
  }
}

export default function FloatingBall() {
  const [state, setState] = useState<AppState>('idle')
  const [partialText, setPartialText] = useState('')
  const audio = useAudioCapture()
  const stateRef = useRef(state)
  stateRef.current = state

  // Drag state
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const mouseDownPos = useRef({ x: 0, y: 0 })

  const startRecording = async () => {
    await audio.start()
    window.electronAPI.startRecording()
  }

  const stopRecording = () => {
    audio.stop()
    window.electronAPI.stopRecording()
  }

  useEffect(() => {
    const unsub1 = window.electronAPI.onStateChange((s) => {
      setState(s as AppState)
      if (s === 'idle') setPartialText('')
    })
    const unsub2 = window.electronAPI.onPartialResult((text) => {
      setPartialText(text)
    })
    const unsub3 = window.electronAPI.onShortcutToggle(async (action) => {
      if (stateRef.current === 'downloading') return
      if (action === 'start' && stateRef.current === 'idle') {
        await startRecording()
      } else if (action === 'stop' && stateRef.current === 'recording') {
        stopRecording()
      }
    })
    return () => { unsub1(); unsub2(); unsub3() }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    hasMoved.current = false
    mouseDownPos.current = { x: e.screenX, y: e.screenY }
    window.electronAPI.startDrag(e.screenX, e.screenY)

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const dx = Math.abs(ev.screenX - mouseDownPos.current.x)
      const dy = Math.abs(ev.screenY - mouseDownPos.current.y)
      if (dx > 3 || dy > 3) {
        hasMoved.current = true
      }
      if (hasMoved.current) {
        window.electronAPI.dragging(ev.screenX, ev.screenY)
      }
    }

    const handleMouseUp = async () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (!hasMoved.current && stateRef.current !== 'downloading') {
        // It was a click, not a drag
        if (stateRef.current === 'idle') {
          await startRecording()
        } else if (stateRef.current === 'recording') {
          stopRecording()
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseEnter = () => {
    // Save the frontmost app BEFORE the user clicks (which would activate Electron)
    window.electronAPI.saveTargetApp()
  }

  return (
    <div className="ball-container" onMouseEnter={handleMouseEnter}>
      <div className={`ball ${state}`} onMouseDown={handleMouseDown}>
        {state === 'recording' && <div className="pulse-ring" />}
        <div className="ball-inner">
          {state === 'processing' ? (
            <div className="spinner" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </div>
      </div>
      {partialText && (
        <div className="partial-text">{partialText}</div>
      )}
    </div>
  )
}
