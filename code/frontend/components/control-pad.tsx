"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { RotateCw, RotateCcw } from "lucide-react"
import { useRobotSocket } from "@/lib/robot-socket"

function getManualPressDuration(): number {
  if (typeof window === 'undefined') return 300
  const stored = localStorage.getItem('manual_press_duration_ms')
  return stored ? parseInt(stored, 10) : 300
}

export default function ControlPad() {
  const { sendManualControl, connected, socket } = useRobotSocket()
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [speed, setSpeed] = useState(75)
  const [pressDuration, setPressDuration] = useState(300)
  const joystickRef = useRef<HTMLDivElement>(null)
  const currentCommandRef = useRef<'forward' | 'backward' | 'left' | 'right' | 'stop'>('stop')
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load press duration from localStorage
  useEffect(() => {
    setPressDuration(getManualPressDuration())
    
    // Listen for custom event when setting changes in same window
    const handlePressDurationChange = () => {
      setPressDuration(getManualPressDuration())
    }
    
    window.addEventListener('manualPressDurationChanged', handlePressDurationChange)
    
    // Also listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'manual_press_duration_ms' && e.newValue) {
        setPressDuration(parseInt(e.newValue, 10))
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('manualPressDurationChanged', handlePressDurationChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Restart interval if pressDuration changes while command is active
  useEffect(() => {
    if (repeatIntervalRef.current && currentCommandRef.current !== 'stop' && connected && socket) {
      const command = currentCommandRef.current
      // Read fresh duration from localStorage
      const duration = getManualPressDuration()
      clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = setInterval(() => {
        if (currentCommandRef.current === command) {
          sendManualControl(command, speed)
        }
      }, duration)
    }
  }, [pressDuration, connected, socket, speed, sendManualControl])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current)
      }
    }
  }, [])

  const startRepeatingCommand = useCallback((command: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
    // Clear any existing interval
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current)
    }
    
    // Set current command
    currentCommandRef.current = command
    
    // Send immediately
    sendManualControl(command, speed)
    
    // Only repeat if not stop
    if (command !== 'stop' && connected && socket) {
      // Always read fresh duration from localStorage to get latest value
      const duration = getManualPressDuration()
      repeatIntervalRef.current = setInterval(() => {
        if (currentCommandRef.current === command) {
          sendManualControl(command, speed)
        }
      }, duration)
    }
  }, [connected, socket, speed, sendManualControl])

  const stopRepeatingCommand = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
    currentCommandRef.current = 'stop'
    sendManualControl('stop', speed)
  }, [speed, sendManualControl])

  const getJoystickPosition = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return { x: 0, y: 0 }
    
    const rect = joystickRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const radius = Math.min(rect.width, rect.height) / 2 - 20
    
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    if (distance > radius) {
      const angle = Math.atan2(deltaY, deltaX)
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      }
    }
    
    return { x: deltaX, y: deltaY }
  }, [])

  const updateMovement = useCallback((pos: { x: number, y: number }) => {
    setJoystickPosition(pos)
    
    if (!connected || !socket) {
      return
    }
    
    const threshold = 10
    const absX = Math.abs(pos.x)
    const absY = Math.abs(pos.y)
    
    let command: 'forward' | 'backward' | 'left' | 'right' | 'stop' = 'stop'
    
    if (absX < threshold && absY < threshold) {
      command = 'stop'
      stopRepeatingCommand()
    } else {
      // Determine primary direction based on which axis is stronger
      if (absY > absX) {
        command = pos.y < 0 ? 'forward' : 'backward'
      } else {
        command = pos.x < 0 ? 'left' : 'right'
      }
      startRepeatingCommand(command)
    }
  }, [connected, socket, stopRepeatingCommand, startRepeatingCommand])

  const handleJoystickStart = useCallback((clientX: number, clientY: number) => {
    if (!connected || !socket) return
    setIsDragging(true)
    const pos = getJoystickPosition(clientX, clientY)
    updateMovement(pos)
  }, [connected, socket, getJoystickPosition, updateMovement])

  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return
    const pos = getJoystickPosition(clientX, clientY)
    updateMovement(pos)
  }, [isDragging, getJoystickPosition, updateMovement])

  const handleJoystickEnd = useCallback(() => {
    setIsDragging(false)
    setJoystickPosition({ x: 0, y: 0 })
    stopRepeatingCommand()
  }, [stopRepeatingCommand])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      handleJoystickMove(e.clientX, e.clientY)
    }

    const handleMouseUp = () => {
      handleJoystickEnd()
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length > 0) {
        handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleTouchEnd = () => {
      handleJoystickEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleJoystickMove, handleJoystickEnd])

  const handleRotation = (direction: 'left' | 'right' | 'stop') => {
    if (!connected || !socket) {
      console.warn('Cannot send rotation command - not connected')
      return
    }
    
    if (direction === 'stop') {
      setRotation(0)
      stopRepeatingCommand()
    } else if (direction === 'left') {
      setRotation((prev) => Math.max(-360, prev - 15))
      startRepeatingCommand('left')
    } else if (direction === 'right') {
      setRotation((prev) => Math.min(360, prev + 15))
      startRepeatingCommand('right')
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8">
      {!connected && (
        <div className="bg-red-500/20 border border-red-500 text-red-500 px-3 sm:px-4 py-2 rounded text-[10px] sm:text-xs font-mono text-center">
          ⚠️ NOT CONNECTED - Controls disabled
        </div>
      )}
      {/* Movement Control - Joystick */}
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-wider mb-1 sm:mb-2">MOVEMENT</div>
        <div
          ref={joystickRef}
          className="relative w-40 h-40 sm:w-48 sm:h-48 bg-neutral-800 border-2 border-neutral-700 rounded-full flex items-center justify-center touch-none select-none"
          onMouseDown={(e) => {
            e.preventDefault()
            handleJoystickStart(e.clientX, e.clientY)
          }}
          onTouchStart={(e) => {
            e.preventDefault()
            if (e.touches.length > 0) {
              handleJoystickStart(e.touches[0].clientX, e.touches[0].clientY)
            }
          }}
        >
          {/* Center dot */}
          <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-neutral-600 rounded-full" />
          
          {/* Joystick handle */}
          <div
            className={`absolute w-14 h-14 sm:w-16 sm:h-16 bg-orange-500 rounded-full flex items-center justify-center transition-transform touch-manipulation ${
              isDragging ? 'scale-110' : ''
            } ${!connected ? 'opacity-50' : ''}`}
            style={{
              transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-600 rounded-full" />
          </div>
          
          {/* Direction indicators */}
          <div className="absolute top-1.5 sm:top-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-neutral-600">↑</div>
          <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-neutral-600">↓</div>
          <div className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-neutral-600">←</div>
          <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-neutral-600">→</div>
        </div>
      </div>

      {/* Rotation Control */}
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-wider mb-1 sm:mb-2">ROTATION</div>
        <div className="flex gap-3 sm:gap-4">
          <button
            onClick={() => handleRotation('left')}
            onMouseDown={() => handleRotation('left')}
            onMouseUp={() => handleRotation('stop')}
            onMouseLeave={() => handleRotation('stop')}
            onTouchStart={() => handleRotation('left')}
            onTouchEnd={() => handleRotation('stop')}
            disabled={!connected}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center justify-center transition-colors touch-manipulation"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={() => handleRotation('stop')}
            disabled={!connected}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-400 rounded flex items-center justify-center transition-colors font-mono text-xs sm:text-sm touch-manipulation"
          >
            {rotation}°
          </button>
          <button
            onClick={() => handleRotation('right')}
            onMouseDown={() => handleRotation('right')}
            onMouseUp={() => handleRotation('stop')}
            onMouseLeave={() => handleRotation('stop')}
            onTouchStart={() => handleRotation('right')}
            onTouchEnd={() => handleRotation('stop')}
            disabled={!connected}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center justify-center transition-colors touch-manipulation"
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Speed Control */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-wider">SPEED</div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setSpeed(Math.max(30, speed - 10))}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-neutral-400 rounded text-xs sm:text-sm touch-manipulation min-h-[44px] sm:min-h-0"
          >
            -
          </button>
          <div className="w-14 sm:w-16 text-center font-mono text-xs sm:text-sm text-white">{speed}%</div>
          <button
            onClick={() => setSpeed(Math.min(100, speed + 10))}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-neutral-400 rounded text-xs sm:text-sm touch-manipulation min-h-[44px] sm:min-h-0"
          >
            +
          </button>
        </div>
      </div>

      {/* Current Movement Display */}
      <div className="bg-neutral-800 border border-neutral-700 p-3 sm:p-4 rounded w-full max-w-xs">
        <div className="text-[10px] sm:text-xs text-neutral-500 uppercase mb-2 sm:mb-3 tracking-wider">CURRENT COMMAND</div>
        <div className="space-y-1.5 sm:space-y-2 font-mono text-xs sm:text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-neutral-400">X:</span>
            <span className="text-green-500">{joystickPosition.x.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-neutral-400">Y:</span>
            <span className="text-green-500">{joystickPosition.y.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-neutral-400">DIR:</span>
            <span className="text-orange-500 truncate">
              {currentCommandRef.current.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-neutral-400">SPEED:</span>
            <span className="text-orange-500">{speed}%</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-neutral-400">ROT:</span>
            <span className="text-blue-500">{rotation}°</span>
          </div>
        </div>
      </div>
    </div>
  )
}
