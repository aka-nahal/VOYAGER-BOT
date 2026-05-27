"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { getStoredIpAddress, getBackendUrl, setStoredIpAddress } from './ip-storage'

interface TrackingData {
  marker_detected: boolean
  position?: { x: number; y: number }
  distance_cm?: number
  confidence?: number
  blob_area?: number
  timestamp?: number
}

interface MotorStatus {
  left_speed: number
  right_speed: number
  enabled: boolean
  mode?: string
  state?: string
}

interface Telemetry {
  cpu_temp: number
  cpu_usage: number
  ram_usage_mb: number
  ram_total_mb: number
  ram_percent: number
  fps_processing: number
  fps_streaming: number
  uptime_seconds: number
  thermal_warning: boolean
  network_bytes_sent: number
  network_bytes_recv: number
  timestamp: number
}

interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: number
}

interface VideoFrame {
  data: string // base64 encoded JPEG
  timestamp: number
  frame_number: number
}

interface ColorInfo {
  key: string
  name: string
  emoji: string
  hsv_min: number[]
  hsv_max: number[]
}

interface ColorsResponse {
  colors: ColorInfo[]
  current: string
  current_display: string
}

interface RobotSocketContextValue {
  socket: Socket | null
  connected: boolean
  trackingData: TrackingData | null
  motorStatus: MotorStatus | null
  telemetry: Telemetry | null
  currentFrame: string | null
  fps: number
  socketUrl: string
  availableColors: ColorInfo[]
  currentColor: string | null
  setBackendUrl: (url: string) => void
  
  // Commands
  sendManualControl: (command: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed?: number) => void
  changeMode: (mode: 'manual' | 'auto') => void
  sendAutoCommand: (action: 'start_following' | 'stop_following') => void
  emergencyStop: () => void
  updateSettings: (category: string, params: Record<string, unknown>) => void
  changeColor: (color: string) => void
  fetchColors: () => Promise<void>
}

const RobotSocketContext = createContext<RobotSocketContextValue | null>(null)

export function RobotSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [motorStatus, setMotorStatus] = useState<MotorStatus | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [socketUrl, setSocketUrl] = useState<string>('')
  const [availableColors, setAvailableColors] = useState<ColorInfo[]>([])
  const [currentColor, setCurrentColor] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [ipChangeTrigger, setIpChangeTrigger] = useState(0)
  const currentUrlRef = useRef<string>('')

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for IP address changes to trigger reconnection
  useEffect(() => {
    if (!mounted) return
    
    const checkIpChange = () => {
      const storedIp = getStoredIpAddress()
      const expectedUrl = storedIp ? getBackendUrl(storedIp) : ''
      if (currentUrlRef.current !== expectedUrl) {
        setIpChangeTrigger(prev => prev + 1)
      }
    }
    
    // Check periodically for IP changes
    const interval = setInterval(checkIpChange, 500)
    
    return () => clearInterval(interval)
  }, [mounted])

  useEffect(() => {
    // Don't connect until after hydration
    if (!mounted) return

    const storedIp = getStoredIpAddress()
    if (!storedIp) {
      // No IP address stored, don't connect yet
      setSocketUrl('')
      currentUrlRef.current = ''
      return
    }

    const url = getBackendUrl(storedIp)
    
    // Skip if already connected to this URL
    if (currentUrlRef.current === url && socket?.connected) {
      return
    }

    setSocketUrl(url)
    currentUrlRef.current = url

    // Disconnect existing socket if URL changes
    if (socket) {
      console.log('Disconnecting old socket due to URL change')
      socket.disconnect()
      setSocket(null)
      setConnected(false)
    }

    console.log('Initializing Socket.IO connection to:', url)
    const newSocket = io(url, {
      transports: ['polling', 'websocket'], // Try polling first on Android
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
      upgrade: true,
    })

    newSocket.on('connect', () => {
      setConnected(true)
      console.log('✅ Frontend: Connected to robot backend')
      console.log('   Socket ID:', newSocket.id)
      console.log('   Socket URL:', newSocket.io.uri)
      console.log('   Transport:', newSocket.io.engine.transport.name)
      console.log('   Available events:', Object.keys(newSocket._callbacks || {}))
    })

    newSocket.on('connect_error', (error) => {
      setConnected(false)
      console.error('❌ Connection error:', error.message)
      console.error('Attempting to connect to:', url)
      console.error('Full error:', error)
    })
    
    newSocket.on('disconnect', (reason) => {
      setConnected(false)
      console.warn('⚠️ Disconnected from backend:', reason)
    })
    
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`)
      setConnected(true)
    })
    
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`)
    })
    
    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message)
    })
    
    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - giving up')
      setConnected(false)
    })

    newSocket.on('connected', (data: { status: string }) => {
      console.log('✅ Connection confirmed:', data)
    })

    newSocket.on('video_frame', (data: VideoFrame) => {
      if (data && data.data) {
        setCurrentFrame(`data:image/jpeg;base64,${data.data}`)
        // Calculate FPS based on timestamp
        const now = Date.now()
        if (data.timestamp) {
          const timeDiff = now - data.timestamp * 1000
          if (timeDiff > 0) {
            setFps(Math.round(1000 / timeDiff))
          }
        }
      }
    })

    newSocket.on('tracking_data', (data: TrackingData) => {
      if (data) {
        setTrackingData(data)
      }
    })

    newSocket.on('motor_status', (data: MotorStatus) => {
      console.log('📊 Frontend: Received motor_status:', data)
      if (data) {
        setMotorStatus({
          ...data,
          enabled: data.enabled !== undefined ? data.enabled : (data.left_speed !== 0 || data.right_speed !== 0),
        })
      }
    })

    newSocket.on('telemetry', (data: Telemetry) => {
      if (data) {
        setTelemetry(data)
      }
    })

    newSocket.on('alert', (data: Alert) => {
      // If emergency stop alert, also stop AI systems
      if (data.level === 'critical' && data.message?.toLowerCase().includes('emergency stop')) {
        if ((globalThis as any).__aiEmergencyStopAll) {
          (globalThis as any).__aiEmergencyStopAll()
        }
      }
      console.warn(`Alert [${data.level}]:`, data.message)
    })

    newSocket.on('mode_changed', (data: { mode: string }) => {
      console.log('Mode changed to:', data.mode)
    })

    newSocket.on('color_changed', (data: { color: string; display_name: string; emoji: string; full_display: string }) => {
      console.log('🎨 Color changed to:', data.full_display)
      setCurrentColor(data.color)
    })

    newSocket.on('error', (data: { message: string }) => {
      console.error('❌ Socket error:', data.message)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [mounted, socketUrl, ipChangeTrigger])

  const sendManualControl = useCallback(
    (command: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed = 75) => {
      console.log('🔵 sendManualControl called:', { command, speed, socket: !!socket, connected, socketId: socket?.id })
      
      if (!socket) {
        console.error('❌ Socket is null!')
        return false
      }
      
      if (!connected) {
        console.error('❌ Not connected! Socket ID:', socket.id, 'Connected:', connected)
        return false
      }
      
      try {
        const data = { command, speed: Math.max(0, Math.min(100, speed)) }
        console.log('🚀 EMITTING manual_control event:', data, 'to socket:', socket.id)
        
        const hasListeners = socket.hasListeners('manual_control')
        console.log('   Socket has manual_control listeners:', hasListeners)
        
        socket.emit('manual_control', data, (response: any) => {
          console.log('   ✅ Server acknowledged command:', response)
        })
        
        console.log('   ✓ Event emitted successfully')
        return true
      } catch (error) {
        console.error('❌ Error sending manual control:', error)
        return false
      }
    },
    [socket, connected]
  )

  const changeMode = useCallback(
    (mode: 'manual' | 'auto') => {
      if (!socket || !connected) return
      socket.emit('mode_change', { mode })
    },
    [socket, connected]
  )

  const sendAutoCommand = useCallback(
    (action: 'start_following' | 'stop_following') => {
      if (!socket || !connected) return
      socket.emit('auto_command', { action })
    },
    [socket, connected]
  )

  const emergencyStop = useCallback(() => {
    if (!socket || !connected) return
    socket.emit('emergency_stop', {})
  }, [socket, connected])

  const updateSettings = useCallback(
    (category: string, params: Record<string, unknown>) => {
      if (!socket || !connected) return
      socket.emit('settings_update', { category, params })
    },
    [socket, connected]
  )

  const changeColor = useCallback(
    (color: string) => {
      if (!socket || !connected) return
      console.log('🎨 Changing color to:', color)
      socket.emit('change_color', { color })
    },
    [socket, connected]
  )

  const fetchColors = useCallback(async () => {
    if (!connected) return
    
    try {
      const storedIp = getStoredIpAddress()
      if (!storedIp) return
      
      const apiUrl = `http://${storedIp}:8000`
      const response = await fetch(`${apiUrl}/api/colors`)
      if (response.ok) {
        const data: ColorsResponse = await response.json()
        setAvailableColors(data.colors)
        setCurrentColor(data.current)
        console.log('🎨 Loaded colors:', data.colors.length, 'Current:', data.current_display)
      }
    } catch (error) {
      console.error('❌ Failed to fetch colors:', error)
    }
  }, [connected])

  // Fetch colors when connected
  useEffect(() => {
    if (connected) {
      fetchColors()
    }
  }, [connected, fetchColors])

  const setBackendUrl = useCallback((url: string) => {
    // This will trigger a reconnection with the new URL
    // The URL should be in format: http://ip:port
    const ipMatch = url.match(/http:\/\/([^:]+)/)
    if (ipMatch) {
      const ip = ipMatch[1]
      setStoredIpAddress(ip)
      // Disconnect existing socket
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setConnected(false)
      }
      // Update URL and ref which will trigger useEffect to reconnect
      currentUrlRef.current = ''
      setSocketUrl(url)
    }
  }, [socket])

  return (
    <RobotSocketContext.Provider
      value={{
        socket,
        connected,
        trackingData,
        motorStatus,
        telemetry,
        currentFrame,
        fps,
        socketUrl,
        availableColors,
        currentColor,
        setBackendUrl,
        sendManualControl,
        changeMode,
        sendAutoCommand,
        emergencyStop,
        updateSettings,
        changeColor,
        fetchColors,
      }}
    >
      {children}
    </RobotSocketContext.Provider>
  )
}

export function useRobotSocket() {
  const context = useContext(RobotSocketContext)
  if (!context) {
    throw new Error('useRobotSocket must be used within RobotSocketProvider')
  }
  return context
}

