"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { LiveSession, LiveServerMessage } from '@google/genai'
import { createLiveSession, processTextMessage } from '@/lib/gemini-live-service'
import { createPcmBlob, decode, decodeAudioData } from '@/lib/ai-audio-utils'
import { useRobotSocket } from '@/lib/robot-socket'

// Utility: Clear global interval
const clearGlobalInterval = (key: string) => {
  const interval = (globalThis as any)[key]
  if (interval) {
    clearInterval(interval)
    ;(globalThis as any)[key] = null
  }
}

// Utility: Stop all audio sources
const stopAllAudioSources = (sources: Set<AudioBufferSourceNode>) => {
  sources.forEach(source => {
    try { source.stop() } catch {}
  })
  sources.clear()
}

// Utility: Enable/disable microphone tracks
const setMicEnabled = (stream: MediaStream | null, enabled: boolean) => {
  stream?.getAudioTracks().forEach(track => { track.enabled = enabled })
}

// Utility: Smart message appending/creation
const updateMessages = (
  prevMessages: Message[],
  sender: MessageSender,
  text: string,
  timestamp: string,
  append: boolean = true
): Message[] => {
  if (!text || text.trim().length === 0) return prevMessages

  const last = prevMessages[prevMessages.length - 1]

  // Append to existing message if same sender and text is new
  if (append && last?.sender === sender && !last.text.includes(text)) {
    return [...prevMessages.slice(0, -1), { ...last, text: last.text + ' ' + text, timestamp }]
  }

  // Create new message if text is genuinely new
  if (!last?.text?.includes(text)) {
    return [...prevMessages, { id: crypto.randomUUID(), sender, text, timestamp }]
  }

  return prevMessages
}

export enum MessageSender {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export interface Message {
  id: string
  sender: MessageSender
  text: string
  timestamp: string
}

export enum AssistantStatus {
  Ready = 'ready',
  Listening = 'listening',
  Processing = 'processing',
  Error = 'error',
}

export interface QueuedCommand {
  id: string
  functionName: string
  args: any
  status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'error'
  displayText: string
}

export const useLiveAssistant = () => {
  const {
    sendManualControl,
    changeMode,
    sendAutoCommand,
    changeColor,
    availableColors,
    connected,
  } = useRobotSocket()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      sender: MessageSender.Assistant,
      text: "Hey! 👋 Ready to have fun? Try 'dance', 'patrol', 'celebrate', or 'helicopter mode'! 🎉",
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.Ready)
  const [useTextInput, setUseTextInput] = useState(false)

  const liveSessionRef = useRef<LiveSession | null>(null)
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null)
  const inputAudioContextRef = useRef<AudioContext | null>(null)
  const outputAudioContextRef = useRef<AudioContext | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const nextStartTimeRef = useRef(0)
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const commandQueueRef = useRef<Array<{ functionName: string; args: any; id: string }>>([])
  const queuedCommandsRef = useRef<Map<string, QueuedCommand>>(new Map())
  const [queuedCommands, setQueuedCommands] = useState<QueuedCommand[]>([])
  const isExecutingQueueRef = useRef(false)
  const keepAliveIntervalsRef = useRef<Set<NodeJS.Timeout>>(new Set())
  const helicopterAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingHelicopterModeRef = useRef(false)
  const pendingCommandsRef = useRef<Array<{ functionName: string; args: any; id: string }>>([])
  const isAISpeakingRef = useRef(false)
  const shouldListenRef = useRef(true)
  const lastProcessedTranscriptionRef = useRef<string>("")
  const commandsExecutedForTurnRef = useRef(false)
  const currentTurnIdRef = useRef<string | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""

  const getTimestamp = useCallback(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), [])

  const addMessage = useCallback((sender: MessageSender, text: string) => {
    if (!text?.trim()) return
    setMessages(prev => updateMessages(prev, sender, text, getTimestamp(), false))
  }, [getTimestamp])

  const enableHelicopterModeNow = useCallback(() => {
    changeMode('manual')
    sendAutoCommand('stop_following')

    // Clear existing intervals
    keepAliveIntervalsRef.current.forEach(clearInterval)
    keepAliveIntervalsRef.current.clear()
    clearGlobalInterval('__robotKeepAliveInterval')

    // Start spinning
    sendManualControl('right', 100)
    const keepAliveInterval = setInterval(() => sendManualControl('right', 100), 300)
    keepAliveIntervalsRef.current.add(keepAliveInterval)
    ;(globalThis as any).__helicopterModeInterval = keepAliveInterval

    // Play audio
    try {
      const audio = helicopterAudioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }

      const newAudio = new Audio('/videoplayback.m4a')
      newAudio.loop = true
      newAudio.volume = 0.8
      newAudio.play().catch(() => addMessage(MessageSender.System, "⚠️ Audio playback failed"))
      helicopterAudioRef.current = newAudio
    } catch {}
  }, [changeMode, sendAutoCommand, sendManualControl, addMessage])

  const executeRobotCommand = useCallback(async (functionName: string, args: any) => {
    if (!connected) {
      addMessage(MessageSender.System, "❌ Robot offline")
      return { result: "error: offline" }
    }

    try {
      switch (functionName) {
        case 'moveRobot': {
          console.log('moveRobot called with args:', args)
          const direction = args.direction
          const duration = args.duration !== undefined ? Number(args.duration) : undefined
          const speed = args.speed !== undefined ? Number(args.speed) : 75
          
          if (direction === 'stop') {
            // Clear intervals
            keepAliveIntervalsRef.current.forEach(clearInterval)
            keepAliveIntervalsRef.current.clear()
            clearGlobalInterval('__robotKeepAliveInterval')
            clearGlobalInterval('__helicopterModeInterval')

            // Stop audio
            const audio = helicopterAudioRef.current
            if (audio) {
              audio.pause()
              audio.currentTime = 0
              helicopterAudioRef.current = null
            }

            // Cancel pending commands
            queuedCommandsRef.current.forEach(cmd => {
              if (cmd.status === 'pending') cmd.status = 'cancelled'
            })
            setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
            commandQueueRef.current = []
            sendManualControl('stop')
            return { result: "ok" }
          }
          
          const commandMap: Record<string, 'forward' | 'backward' | 'left' | 'right'> = {
            forward: 'forward',
            backward: 'backward',
            left: 'left',
            right: 'right',
          }
          
          const command = commandMap[direction?.toLowerCase()]
          if (command) {
            if (duration !== undefined && duration > 0) {
              // Timed movement
              sendManualControl(command, speed)
              const endTime = Date.now() + duration * 1000

              const keepAliveInterval = setInterval(() => {
                if (Date.now() < endTime) {
                  sendManualControl(command, speed)
                } else {
                  clearInterval(keepAliveInterval)
                  keepAliveIntervalsRef.current.delete(keepAliveInterval)
                  sendManualControl('stop')
                }
              }, 300)
              keepAliveIntervalsRef.current.add(keepAliveInterval)

              await new Promise(resolve => setTimeout(resolve, duration * 1000))
              clearInterval(keepAliveInterval)
              keepAliveIntervalsRef.current.delete(keepAliveInterval)
              sendManualControl('stop')

              return { result: `ok: moved ${direction} ${duration}s` }
            } else {
              // Continuous movement
              const keepAliveInterval = setInterval(() => sendManualControl(command, speed), 300)
              keepAliveIntervalsRef.current.add(keepAliveInterval)
              ;(globalThis as any).__robotKeepAliveInterval = keepAliveInterval

              return { result: `ok: moving ${direction}` }
            }
          }
          return { result: "error: invalid direction" }
        }

        case 'enableAutonomous': {
          clearGlobalInterval('__helicopterModeInterval')
          const audio = helicopterAudioRef.current
          if (audio) {
            audio.pause()
            audio.currentTime = 0
            helicopterAudioRef.current = null
          }
          sendManualControl('stop')
          changeMode('auto')
          sendAutoCommand('start_following')
          return { result: "ok: autonomous enabled" }
        }

        case 'disableAutonomous': {
          changeMode('manual')
          sendAutoCommand('stop_following')
          return { result: "ok: autonomous disabled" }
        }

        case 'changeColor': {
          const { color } = args
          const colorKey = availableColors.find(
            c => c.key === color.toLowerCase() || c.name.toLowerCase() === color.toLowerCase()
          )?.key

          if (colorKey) {
            changeColor(colorKey)
            return { result: `ok: tracking ${color}` }
          }
          return { result: `error: unknown color` }
        }

        case 'enableHelicopterMode': {
          if (audioSourcesRef.current.size > 0) {
            pendingHelicopterModeRef.current = true
            return { result: "ok: queued" }
          }
          enableHelicopterModeNow()
          return { result: "ok: helicopter enabled" }
        }

        case 'disableHelicopterMode': {
          clearGlobalInterval('__helicopterModeInterval')
          sendManualControl('stop')
          const audio = helicopterAudioRef.current
          if (audio) {
            audio.pause()
            audio.currentTime = 0
            helicopterAudioRef.current = null
          }
          return { result: "ok: helicopter disabled" }
        }

        case 'danceMode': {
          // Fun dance routine: spin right, spin left, forward, back
          const danceRoutine = async () => {
            clearGlobalInterval('__robotKeepAliveInterval')
            clearGlobalInterval('__helicopterModeInterval')

            // Spin right
            sendManualControl('right', 100)
            await new Promise(resolve => setTimeout(resolve, 800))

            // Spin left
            sendManualControl('left', 100)
            await new Promise(resolve => setTimeout(resolve, 800))

            // Forward shimmy
            sendManualControl('forward', 80)
            await new Promise(resolve => setTimeout(resolve, 400))
            sendManualControl('stop')
            await new Promise(resolve => setTimeout(resolve, 200))

            // Backward shimmy
            sendManualControl('backward', 80)
            await new Promise(resolve => setTimeout(resolve, 400))
            sendManualControl('stop')
            await new Promise(resolve => setTimeout(resolve, 200))

            // Final spin
            sendManualControl('right', 100)
            await new Promise(resolve => setTimeout(resolve, 600))
            sendManualControl('stop')
          }

          danceRoutine().catch(console.error)
          return { result: "ok: dancing! 💃" }
        }

        case 'patrolMode': {
          // Square patrol pattern
          const patrolRoutine = async () => {
            clearGlobalInterval('__robotKeepAliveInterval')
            clearGlobalInterval('__helicopterModeInterval')

            for (let i = 0; i < 4; i++) {
              // Move forward
              sendManualControl('forward', 75)
              await new Promise(resolve => setTimeout(resolve, 1500))
              sendManualControl('stop')
              await new Promise(resolve => setTimeout(resolve, 300))

              // Turn right 90 degrees
              sendManualControl('right', 75)
              await new Promise(resolve => setTimeout(resolve, 500))
              sendManualControl('stop')
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }

          patrolRoutine().catch(console.error)
          return { result: "ok: on patrol 🎯" }
        }

        case 'celebrateMode': {
          // Victory celebration: multiple spins and moves
          const celebrateRoutine = async () => {
            clearGlobalInterval('__robotKeepAliveInterval')
            clearGlobalInterval('__helicopterModeInterval')

            // Victory spins
            for (let i = 0; i < 3; i++) {
              sendManualControl('right', 100)
              await new Promise(resolve => setTimeout(resolve, 600))
              sendManualControl('stop')
              await new Promise(resolve => setTimeout(resolve, 200))
            }

            // Jump forward and back
            sendManualControl('forward', 100)
            await new Promise(resolve => setTimeout(resolve, 300))
            sendManualControl('stop')
            await new Promise(resolve => setTimeout(resolve, 150))
            sendManualControl('backward', 100)
            await new Promise(resolve => setTimeout(resolve, 300))
            sendManualControl('stop')
            await new Promise(resolve => setTimeout(resolve, 150))

            // Final celebration spin
            sendManualControl('right', 100)
            await new Promise(resolve => setTimeout(resolve, 1000))
            sendManualControl('stop')
          }

          celebrateRoutine().catch(console.error)
          return { result: "ok: party time! 🎉" }
        }

        case 'zigzagMode': {
          // Zigzag pattern
          const zigzagRoutine = async () => {
            clearGlobalInterval('__robotKeepAliveInterval')
            clearGlobalInterval('__helicopterModeInterval')

            for (let i = 0; i < 4; i++) {
              // Move forward
              sendManualControl('forward', 75)
              await new Promise(resolve => setTimeout(resolve, 800))

              // Alternate between right and left turns
              const direction = i % 2 === 0 ? 'right' : 'left'
              sendManualControl(direction, 80)
              await new Promise(resolve => setTimeout(resolve, 400))
            }

            sendManualControl('stop')
          }

          zigzagRoutine().catch(console.error)
          return { result: "ok: zigzag! ⚡" }
        }

        default:
          return { result: `error: unknown command` }
      }
    } catch (error) {
      console.error('Command error:', error)
      return { result: `error: ${error instanceof Error ? error.message : 'failed'}` }
    }
  }, [connected, sendManualControl, changeMode, sendAutoCommand, changeColor, availableColors, addMessage, enableHelicopterModeNow])

  const executeCommandQueue = useCallback(async () => {
    if (isExecutingQueueRef.current || commandQueueRef.current.length === 0) {
      return
    }

    isExecutingQueueRef.current = true
    const queueLength = commandQueueRef.current.length
    const activeCommands = commandQueueRef.current.filter(
      cmd => queuedCommandsRef.current.get(cmd.id)?.status !== 'cancelled'
    ).length
    
    // Skip status message for speed - commands execute immediately

    while (commandQueueRef.current.length > 0) {
      // Check if queue was cancelled
      if (!isExecutingQueueRef.current) {
        break
      }
      
      const command = commandQueueRef.current.shift()
      if (command) {
        const queuedCmd = queuedCommandsRef.current.get(command.id)
        
        // Skip cancelled commands
        if (queuedCmd && queuedCmd.status === 'cancelled') {
          continue
        }
        
        // Update status to executing
        if (queuedCmd) {
          queuedCmd.status = 'executing'
          queuedCommandsRef.current.set(command.id, queuedCmd)
          setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
        }
        
        try {
          await executeRobotCommand(command.functionName, command.args)
          
          // Check if command was cancelled during execution
          const updatedCmd = queuedCommandsRef.current.get(command.id)
          if (updatedCmd && updatedCmd.status === 'cancelled') {
            continue // Skip if cancelled
          }
          
          // Update status to completed
          if (queuedCmd) {
            queuedCmd.status = 'completed'
            queuedCommandsRef.current.set(command.id, queuedCmd)
            setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
            
            // Remove completed command quickly
            setTimeout(() => {
              queuedCommandsRef.current.delete(command.id)
              setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
            }, 300) // Fast cleanup
          }
        } catch (error) {
          console.error('Command execution error:', error)
          // Update status to error
          if (queuedCmd) {
            queuedCmd.status = 'error'
            queuedCommandsRef.current.set(command.id, queuedCmd)
            setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
            addMessage(MessageSender.System, `❌ ${queuedCmd.displayText}`)
          }
        }
        
        // Fast command execution
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }

    isExecutingQueueRef.current = false
    
    // Skip completion message for speed - commands execute silently and quickly
  }, [executeRobotCommand, addMessage])

  const formatCommandDisplay = useCallback((functionName: string, args: any): string => {
    switch (functionName) {
      case 'moveRobot': {
        const { direction, duration, speed } = args
        if (direction === 'stop') return 'Stop'
        const dur = duration ? ` ${duration}s` : ''
        const spd = speed && speed !== 75 ? ` @${speed}%` : ''
        return `${direction}${dur}${spd}`
      }
      case 'enableAutonomous': return 'Auto ON'
      case 'disableAutonomous': return 'Auto OFF'
      case 'changeColor': return `Track ${args.color}`
      case 'enableHelicopterMode': return 'Helicopter 🚁'
      case 'disableHelicopterMode': return 'Stop helicopter'
      case 'danceMode': return 'Dance Mode 💃'
      case 'patrolMode': return 'Patrol Mode 🎯'
      case 'celebrateMode': return 'Celebrate 🎉'
      case 'zigzagMode': return 'Zigzag ⚡'
      default: return functionName
    }
  }, [])

  const queueCommand = useCallback((functionName: string, args: any) => {
    const id = crypto.randomUUID()
    const displayText = formatCommandDisplay(functionName, args)
    
    const queuedCommand: QueuedCommand = {
      id,
      functionName,
      args,
      status: 'pending',
      displayText,
    }
    
    commandQueueRef.current.push({ functionName, args, id })
    queuedCommandsRef.current.set(id, queuedCommand)
    setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
    
    if (!isExecutingQueueRef.current) {
      executeCommandQueue()
    }
  }, [executeCommandQueue, formatCommandDisplay])

  const cancelQueuedCommand = useCallback((id: string) => {
    const command = queuedCommandsRef.current.get(id)
    if (command) {
      if (command.status === 'pending') {
        command.status = 'cancelled'
        queuedCommandsRef.current.set(id, command)
        setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
        commandQueueRef.current = commandQueueRef.current.filter(cmd => cmd.id !== id)
        addMessage(MessageSender.System, `⛔ Cancelled`)
      } else if (command.status === 'executing') {
        addMessage(MessageSender.System, `⛔ Stopping`)
        sendManualControl('stop')
        command.status = 'cancelled'
        queuedCommandsRef.current.set(id, command)
        setQueuedCommands(Array.from(queuedCommandsRef.current.values()))
        commandQueueRef.current = commandQueueRef.current.filter(cmd => cmd.id !== id)
      }
    }
  }, [addMessage, sendManualControl])

  const cancelAllQueuedCommands = useCallback(() => {
    const cancelledCount = Array.from(queuedCommandsRef.current.values())
      .filter(cmd => cmd.status === 'pending' || cmd.status === 'executing').length

    // Cancel commands
    queuedCommandsRef.current.forEach(cmd => {
      if (cmd.status === 'pending' || cmd.status === 'executing') cmd.status = 'cancelled'
    })

    commandQueueRef.current = []
    isExecutingQueueRef.current = false
    setQueuedCommands(Array.from(queuedCommandsRef.current.values()))

    // Clear intervals
    keepAliveIntervalsRef.current.forEach(clearInterval)
    keepAliveIntervalsRef.current.clear()
    clearGlobalInterval('__robotKeepAliveInterval')
    clearGlobalInterval('__helicopterModeInterval')

    // Stop audio
    const audio = helicopterAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      helicopterAudioRef.current = null
    }

    sendManualControl('stop')
    if (cancelledCount > 0) addMessage(MessageSender.System, `⛔ Cancelled ${cancelledCount}`)
  }, [sendManualControl, addMessage])

  const stopListening = useCallback(() => {
    clearGlobalInterval('__audioBufferFlushInterval')

    // Stop microphone
    mediaStreamRef.current?.getTracks().forEach(track => {
      track.stop()
      track.enabled = false
    })

    // Disconnect processor
    try { scriptProcessorRef.current?.disconnect() } catch {}

    // Close contexts
    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close().catch(console.error)
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close().catch(console.error)
    }

    stopAllAudioSources(audioSourcesRef.current)

    // Close session
    sessionPromiseRef.current?.then(session => {
      try { session.close() } catch (e) { console.error('Close error:', e) }
    }).catch(console.error)

    // Clear refs
    liveSessionRef.current = null
    sessionPromiseRef.current = null
    mediaStreamRef.current = null
    scriptProcessorRef.current = null
    inputAudioContextRef.current = null
    outputAudioContextRef.current = null
    nextStartTimeRef.current = 0

    setStatus(s => (s === AssistantStatus.Listening || s === AssistantStatus.Processing)
      ? AssistantStatus.Ready : s)

    addMessage(MessageSender.System, "🎤 Stopped")
  }, [addMessage])

  const handleLiveError = useCallback((error: ErrorEvent) => {
    console.error('Live error:', error)

    let msg = "❌ Connection error"

    if (error.message?.includes('unavailable')) {
      msg = '❌ Service unavailable. Try again.'
    } else if (error.message?.includes('quota')) {
      msg = '❌ API quota exceeded'
    } else if (error.message?.includes('network')) {
      msg = '❌ Network error'
    }

    addMessage(MessageSender.System, msg)
    setStatus(AssistantStatus.Error)
  }, [addMessage])

  const handleLiveMessage = useCallback(async (message: LiveServerMessage) => {
    if (message.serverContent) {
      // Handle input transcription (user speech)
      if (message.serverContent.inputTranscription) {
        const text = message.serverContent.inputTranscription.text.trim()
        if (text) {
          setStatus(s => s === AssistantStatus.Ready ? AssistantStatus.Listening : s)
          setMessages(prev => updateMessages(prev, MessageSender.User, text, getTimestamp()))
        }
      }
      
      // Handle output transcription (assistant speech)
      if (message.serverContent.outputTranscription) {
        const text = message.serverContent.outputTranscription.text.trim()
        if (text && text !== lastProcessedTranscriptionRef.current) {
          lastProcessedTranscriptionRef.current = text

          // AI speaking - disable mic
          if (!isAISpeakingRef.current) {
            isAISpeakingRef.current = true
            shouldListenRef.current = false
            setStatus(AssistantStatus.Processing)
            setMicEnabled(mediaStreamRef.current, false)
          }

          setMessages(prev => updateMessages(prev, MessageSender.Assistant, text, getTimestamp()))
        }
      }
      
      // Handle turn completion
      if (message.serverContent.turnComplete) {
        lastProcessedTranscriptionRef.current = ""

        if (audioSourcesRef.current.size === 0) {
          isAISpeakingRef.current = false
          shouldListenRef.current = true
          setMicEnabled(mediaStreamRef.current, true)
          setStatus(AssistantStatus.Listening)

          // Execute pending commands
          if (pendingCommandsRef.current.length > 0 && !commandsExecutedForTurnRef.current) {
            commandsExecutedForTurnRef.current = true
            const commands = [...pendingCommandsRef.current]
            pendingCommandsRef.current = []
            commands.forEach(cmd => queueCommand(cmd.functionName, cmd.args))
            setTimeout(() => {
              commandsExecutedForTurnRef.current = false
              currentTurnIdRef.current = null
            }, 200)
          }

          if (pendingHelicopterModeRef.current && !commandsExecutedForTurnRef.current) {
            pendingHelicopterModeRef.current = false
            enableHelicopterModeNow()
          }
        }
      }
      
      // Handle interruptions
      if (message.serverContent.interrupted) {
        queuedCommandsRef.current.forEach(cmd => {
          if (cmd.status === 'pending') cmd.status = 'cancelled'
        })
        commandQueueRef.current = []
        setQueuedCommands(Array.from(queuedCommandsRef.current.values()))

        shouldListenRef.current = false
        isAISpeakingRef.current = false
        setMicEnabled(mediaStreamRef.current, false)
        setStatus(AssistantStatus.Ready)
      }
    }

    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data
    if (base64Audio) {
      // AI speaking
      if (!isAISpeakingRef.current) {
        isAISpeakingRef.current = true
        shouldListenRef.current = false
        setStatus(AssistantStatus.Processing)
        setMicEnabled(mediaStreamRef.current, false)
      }

      if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
      }
      const ctx = outputAudioContextRef.current

      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime)
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)

      source.addEventListener('ended', () => {
        audioSourcesRef.current.delete(source)

        if (audioSourcesRef.current.size === 0) {
          isAISpeakingRef.current = false
          shouldListenRef.current = true
          setMicEnabled(mediaStreamRef.current, true)
          setStatus(AssistantStatus.Listening)

          // Execute pending commands
          if (pendingCommandsRef.current.length > 0 && !commandsExecutedForTurnRef.current) {
            commandsExecutedForTurnRef.current = true
            const commands = [...pendingCommandsRef.current]
            pendingCommandsRef.current = []
            commands.forEach(cmd => queueCommand(cmd.functionName, cmd.args))
            setTimeout(() => { commandsExecutedForTurnRef.current = false }, 200)
          }

          if (pendingHelicopterModeRef.current && !commandsExecutedForTurnRef.current) {
            pendingHelicopterModeRef.current = false
            enableHelicopterModeNow()
          }
        }
      })

      source.start(nextStartTimeRef.current)
      nextStartTimeRef.current += audioBuffer.duration
      audioSourcesRef.current.add(source)
    }

    // Handle backward compatibility for interruptions
    if (message.serverContent?.interrupted) {
      stopAllAudioSources(audioSourcesRef.current)
      nextStartTimeRef.current = 0
      pendingCommandsRef.current = []
      pendingHelicopterModeRef.current = false
      commandsExecutedForTurnRef.current = false
      currentTurnIdRef.current = null
      lastProcessedTranscriptionRef.current = ""
      isAISpeakingRef.current = false
      shouldListenRef.current = false
      setMicEnabled(mediaStreamRef.current, false)
      setStatus(AssistantStatus.Ready)
      addMessage(MessageSender.System, "⚠️ Interrupted")
    }

    if (message.toolCall) {
      isAISpeakingRef.current = true
      shouldListenRef.current = false
      setStatus(AssistantStatus.Processing)
      setMicEnabled(mediaStreamRef.current, false)

      const functionCalls = message.toolCall.functionCalls

      // Add to pending (deduplicated)
      for (const fc of functionCalls) {
        const isDuplicate = pendingCommandsRef.current.some(
          cmd => cmd.functionName === fc.name && JSON.stringify(cmd.args) === JSON.stringify(fc.args)
        )
        if (!isDuplicate) {
          pendingCommandsRef.current.push({ functionName: fc.name, args: fc.args, id: crypto.randomUUID() })
        }
      }

      // Acknowledge
      sessionPromiseRef.current?.then(session => {
        functionCalls.forEach(fc => {
          session.sendToolResponse({
            functionResponses: { id: fc.id, name: fc.name, response: { result: "ok: queued" } }
          })
        })
      }).catch(console.error)
    }
  }, [addMessage, getTimestamp, queueCommand, executeCommandQueue])

  const startListening = useCallback(async () => {
    if (!apiKey) {
      addMessage(MessageSender.System, "❌ API key missing")
      return
    }

    if (status === AssistantStatus.Listening) return

    stopAllAudioSources(audioSourcesRef.current)
    shouldListenRef.current = true
    isAISpeakingRef.current = false
    setStatus(AssistantStatus.Listening)
    nextStartTimeRef.current = 0

    try {
      if (!sessionPromiseRef.current) {
        console.log("Session not pre-initialized. Initializing now.")
        sessionPromiseRef.current = createLiveSession(apiKey, handleLiveMessage, handleLiveError)
      }
      
      liveSessionRef.current = await sessionPromiseRef.current
      
      // Request microphone access with enhanced noise filtering
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
          // Enhanced Google-specific audio processing
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googNoiseReduction: true,
          googAudioMirroring: false,
          googDAEchoCancellation: true,
          googDucking: false
        } 
      })
      mediaStreamRef.current = stream

      // Create audio context with optimized settings
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      })
      
      if (context.state === 'suspended') {
        await context.resume()
      }
      
      inputAudioContextRef.current = context
      const source = context.createMediaStreamSource(stream)
      
      // Create gain node for volume normalization with adaptive gain - boost for better understanding
      const gainNode = context.createGain()
      gainNode.gain.value = 1.5 // Increased gain to boost quieter speech for better understanding
      
      // Less aggressive highpass filter - preserve more voice frequencies
      const highpassFilter = context.createBiquadFilter()
      highpassFilter.type = 'highpass'
      highpassFilter.frequency.value = 60 // Lowered to preserve more voice frequencies (was 100Hz)
      highpassFilter.Q.value = 0.7 // Lower Q for gentler filtering
      
      // Less aggressive lowpass filter - preserve more voice frequencies
      const lowpassFilter = context.createBiquadFilter()
      lowpassFilter.type = 'lowpass'
      lowpassFilter.frequency.value = 10000 // Increased to preserve more voice harmonics (was 8000Hz)
      lowpassFilter.Q.value = 0.7 // Lower Q for gentler filtering
      
      // Add notch filter for common noise frequencies (50/60Hz electrical hum)
      const notchFilter = context.createBiquadFilter()
      notchFilter.type = 'notch'
      notchFilter.frequency.value = 60 // Filter 60Hz electrical noise
      notchFilter.Q.value = 10.0
      
      // Use ScriptProcessorNode with smaller buffer size for lower latency
      const processor = context.createScriptProcessor(1024, 1, 1) // Smaller buffer (1024) for faster processing and lower latency
      scriptProcessorRef.current = processor
      
      let lastSendTime = 0
      const minSendInterval = 3 // Reduced to 3ms for smoother, more continuous audio streaming
      let audioBuffer: Float32Array[] = []
      const bufferSize = 3 // Increased to 3 for smoother, more fluent audio capture
      let silenceCounter = 0
      const silenceThreshold = 0.0012 // Optimized threshold for smooth, continuous listening
      const minSamplesForVoice = 2 // Slight increase for smoother transitions
      const maxSilenceBeforeFlush = 5 // Allow brief pauses without cutting off speech
      
      // Adaptive noise floor tracking - smooth and continuous
      let noiseFloor = 0.0004 // Lower initial noise floor for smoother capture
      let noiseFloorAlpha = 0.88 // Balanced adaptation for smooth transitions
      let voiceActivityHistory: number[] = []
      const historySize = 3 // Balanced for smooth, confident detection
      
      // Enhanced voice activity detection with spectral analysis
      const detectVoiceActivity = (audioData: Float32Array): boolean => {
        // Calculate RMS (Root Mean Square) for better voice detection
        let sumSquares = 0
        let maxAmplitude = 0
        let zeroCrossings = 0
        let prevSign = audioData[0] >= 0
        
        for (let i = 0; i < audioData.length; i++) {
          const sample = audioData[i]
          const abs = Math.abs(sample)
          sumSquares += sample * sample
          if (abs > maxAmplitude) {
            maxAmplitude = abs
          }
          
          // Count zero crossings (voice has more zero crossings than noise)
          const currentSign = sample >= 0
          if (currentSign !== prevSign) {
            zeroCrossings++
          }
          prevSign = currentSign
        }
        
        const rms = Math.sqrt(sumSquares / audioData.length)
        const zeroCrossingRate = zeroCrossings / audioData.length
        
        // Update adaptive noise floor (only when no voice detected)
        if (rms < silenceThreshold * 1.5) {
          noiseFloor = noiseFloor * noiseFloorAlpha + rms * (1 - noiseFloorAlpha)
        }
        
        // Smooth, confident voice detection - continuous and fluent
        const dynamicThreshold = Math.max(silenceThreshold * 0.65, noiseFloor * 1.4) // Smooth threshold
        const hasVoice = rms > dynamicThreshold || maxAmplitude > dynamicThreshold * 1.4
        
        // Voice characteristics with smooth range for fluent detection
        const hasVoiceCharacteristics = zeroCrossingRate > 0.002 && zeroCrossingRate < 0.22
        
        // Update voice activity history for smooth transitions
        voiceActivityHistory.push(hasVoice ? 1 : 0)
        if (voiceActivityHistory.length > historySize) {
          voiceActivityHistory.shift()
        }
        
        // Smooth, confident detection - accept voice with slight history for fluency
        const recentVoiceCount = voiceActivityHistory.reduce((a, b) => a + b, 0)
        const consistentVoice = recentVoiceCount >= 1 // Smooth confidence threshold
        
        // Smooth, fluent detection: accept voice with confidence for continuous listening
        return hasVoice || (hasVoiceCharacteristics && recentVoiceCount >= 1) || rms > noiseFloor * 1.15
      }
      
      // Less aggressive noise reduction - preserve more speech
      const reduceNoise = (audioData: Float32Array): Float32Array => {
        const filtered = new Float32Array(audioData.length)
        const alpha = 0.05 // Reduced noise reduction to preserve more speech
        
        for (let i = 0; i < audioData.length; i++) {
          const sample = audioData[i]
          const abs = Math.abs(sample)
          
          // Less aggressive spectral subtraction - preserve more of the signal
          if (abs > noiseFloor * 0.8) {
            // Preserve signal above noise floor with less attenuation
            filtered[i] = sample * (1 - alpha * (noiseFloor / Math.max(abs, noiseFloor)))
          } else {
            // Less aggressive attenuation to preserve quiet speech
            filtered[i] = sample * 0.3 // Increased from 0.1 to preserve more
          }
        }
        
        return filtered
      }
      
      processor.onaudioprocess = (audioProcessingEvent) => {
        // Don't process audio if AI is speaking or we shouldn't listen
        if (!shouldListenRef.current || isAISpeakingRef.current) {
          return
        }
        
        const now = Date.now()
        if (now - lastSendTime < minSendInterval) {
          return // Throttle audio sending
        }
        
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0)
        
        // Apply noise reduction first
        const noiseReduced = reduceNoise(inputData)
        
        // Enhanced voice activity detection
        const hasVoice = detectVoiceActivity(noiseReduced)
        
        if (hasVoice) {
          silenceCounter = 0
          
          // Advanced audio normalization with dynamic range compression
          const normalizedAudio = new Float32Array(noiseReduced.length)
          let maxVal = 0
          
          // Calculate statistics
          for (let i = 0; i < noiseReduced.length; i++) {
            const abs = Math.abs(noiseReduced[i])
            if (abs > maxVal) maxVal = abs
          }
          
          // Smooth, consistent audio normalization for fluent, confident listening
          let normalizeFactor = 1.0
          if (maxVal > 0) {
            if (maxVal < 0.4) {
              // Smooth boost for quiet speech - consistent and confident
              normalizeFactor = Math.min(0.95 / maxVal, 2.4) // Smooth boost for fluency
            } else if (maxVal > 0.85) {
              // Smooth compression for loud signals - prevent clipping while maintaining quality
              normalizeFactor = 0.87 / maxVal
            } else {
              // Normal range - smooth, consistent boost for clear, fluent speech
              normalizeFactor = 1.25 // Optimized for smooth, confident audio
            }
          }
          
          // Apply smooth normalization with gentle soft limiting for fluent audio
          for (let i = 0; i < noiseReduced.length; i++) {
            let sample = noiseReduced[i] * normalizeFactor
            // Smooth, gentle soft limiter - prevents clipping while maintaining natural sound
            if (sample > 0.95) {
              sample = 0.95 + (sample - 0.95) * 0.15 // Slightly more gentle for smoother sound
            } else if (sample < -0.95) {
              sample = -0.95 + (sample + 0.95) * 0.15 // Smooth limiting for natural flow
            }
            normalizedAudio[i] = sample
          }
          
          // Buffer normalized audio
          audioBuffer.push(normalizedAudio)
          
          // Smooth, continuous audio streaming - send when buffer is ready for fluent listening
          if (audioBuffer.length >= bufferSize) {
            // Combine buffered audio
            const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0)
            const combinedAudio = new Float32Array(totalLength)
            let offset = 0
            audioBuffer.forEach(arr => {
              combinedAudio.set(arr, offset)
              offset += arr.length
            })
            
            const pcmBlob = createPcmBlob(combinedAudio)
            sessionPromiseRef.current?.then((session) => {
              try {
                session.sendRealtimeInput({ media: pcmBlob })
                lastSendTime = now
              } catch (error) {
                console.error('Error sending audio:', error)
              }
            }).catch(error => {
              console.error('Session error:', error)
            })
            
            audioBuffer = []
          }
        } else {
          silenceCounter++
          
          // Smooth handling: allow brief pauses without cutting off speech
          // Flush only after longer silence for fluent, continuous conversation
          if (audioBuffer.length > 0 && silenceCounter >= maxSilenceBeforeFlush) {
            const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0)
            const combinedAudio = new Float32Array(totalLength)
            let offset = 0
            audioBuffer.forEach(arr => {
              combinedAudio.set(arr, offset)
              offset += arr.length
            })
            
            const pcmBlob = createPcmBlob(combinedAudio)
            sessionPromiseRef.current?.then((session) => {
              try {
                session.sendRealtimeInput({ media: pcmBlob })
                lastSendTime = Date.now()
              } catch (error) {
                console.error('Error sending audio:', error)
              }
            }).catch(error => {
              console.error('Session error:', error)
            })
            
            audioBuffer = []
            silenceCounter = 0
          }
        }
      }
      
      // Smooth, continuous buffer flushing for fluent audio streaming
      const bufferFlushInterval = setInterval(() => {
        if (audioBuffer.length > 0) {
          const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0)
          const combinedAudio = new Float32Array(totalLength)
          let offset = 0
          audioBuffer.forEach(arr => {
            combinedAudio.set(arr, offset)
            offset += arr.length
          })
          
          const pcmBlob = createPcmBlob(combinedAudio)
          sessionPromiseRef.current?.then((session) => {
            try {
              session.sendRealtimeInput({ media: pcmBlob })
              lastSendTime = Date.now()
            } catch (error) {
              console.error('Error sending audio:', error)
            }
          }).catch(error => {
            console.error('Session error:', error)
          })
          
          audioBuffer = []
        }
      }, 25) // Optimized to 25ms for smooth, fluent, continuous audio streaming
      
      // Store flush interval for cleanup
      ;(globalThis as any).__audioBufferFlushInterval = bufferFlushInterval
      
      // Connect audio nodes: source -> gain -> highpass -> notch -> lowpass -> processor -> destination
      source.connect(gainNode)
      gainNode.connect(highpassFilter)
      highpassFilter.connect(notchFilter)
      notchFilter.connect(lowpassFilter)
      lowpassFilter.connect(processor)
      processor.connect(context.destination)
      
      addMessage(MessageSender.System, "🎤 Listening")

    } catch (err: unknown) {
      console.error("Mic error:", err)
      let msg = "❌ Microphone error"

      if (err instanceof Error) {
        switch (err.name) {
          case 'NotAllowedError':
            msg = '❌ Mic permission denied'
            break
          case 'NotFoundError':
            msg = '❌ No microphone found'
            break
          case 'NotReadableError':
            msg = '❌ Mic in use by another app'
            break
          case 'OverconstrainedError':
            msg = '❌ Mic not supported'
            break
          default:
            msg = `❌ ${err.message || 'Mic failed'}`
            break
        }
      }

      addMessage(MessageSender.System, msg)
      setStatus(AssistantStatus.Error)
    }
  }, [status, apiKey, handleLiveMessage, handleLiveError, addMessage, getTimestamp])
  
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || !apiKey) return

    addMessage(MessageSender.User, text)
    setStatus(AssistantStatus.Processing)
    commandsExecutedForTurnRef.current = false
    currentTurnIdRef.current = Date.now().toString()
    lastProcessedTranscriptionRef.current = ""

    try {
      const stream = await processTextMessage(apiKey, text)
      let firstChunk = true
      let lastChunkText = ""

      for await (const chunk of stream) {
        if (chunk.functionCalls?.length > 0) {
          for (const fc of chunk.functionCalls) {
            const isDuplicate = pendingCommandsRef.current.some(
              cmd => cmd.functionName === fc.name && JSON.stringify(cmd.args) === JSON.stringify(fc.args)
            )
            if (!isDuplicate) {
              pendingCommandsRef.current.push({ functionName: fc.name, args: fc.args, id: crypto.randomUUID() })
            }
          }
          break
        }

        const chunkText = chunk.text
        if (chunkText && chunkText !== lastChunkText) {
          lastChunkText = chunkText
          setMessages(prev => updateMessages(
            prev,
            MessageSender.Assistant,
            chunkText,
            getTimestamp(),
            !firstChunk
          ))
          firstChunk = false
        }
      }
    } catch (error) {
      console.error("Text error:", error)
      addMessage(MessageSender.System, "❌ Error")
    } finally {
      setStatus(AssistantStatus.Ready)

      if (pendingCommandsRef.current.length > 0 && !commandsExecutedForTurnRef.current) {
        commandsExecutedForTurnRef.current = true
        const commands = [...pendingCommandsRef.current]
        pendingCommandsRef.current = []
        commands.forEach(cmd => queueCommand(cmd.functionName, cmd.args))
        setTimeout(() => { commandsExecutedForTurnRef.current = false }, 200)
      }
    }
  }, [apiKey, addMessage, getTimestamp, queueCommand])

  useEffect(() => {
    if (status === AssistantStatus.Error) {
      stopListening()
    }
  }, [status, stopListening])

  useEffect(() => {
    if (!useTextInput && !sessionPromiseRef.current && status === AssistantStatus.Ready && apiKey) {
      console.log("Pre-initializing live session...")
      sessionPromiseRef.current = createLiveSession(apiKey, handleLiveMessage, handleLiveError)
      sessionPromiseRef.current.catch(err => {
        console.error("Pre-initialization failed:", err)
        sessionPromiseRef.current = null
      })
    } else if (useTextInput && sessionPromiseRef.current) {
      console.log("Closing pre-initialized session due to text input mode.")
      sessionPromiseRef.current.then(session => session.close()).catch(console.error)
      sessionPromiseRef.current = null
    }
  }, [useTextInput, status, apiKey, handleLiveMessage, handleLiveError])
  
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  const emergencyStopAll = useCallback(() => {
    // Stop intervals
    clearGlobalInterval('__helicopterModeInterval')
    clearGlobalInterval('__robotKeepAliveInterval')
    keepAliveIntervalsRef.current.forEach(clearInterval)
    keepAliveIntervalsRef.current.clear()

    // Stop audio
    const audio = helicopterAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      helicopterAudioRef.current = null
    }

    // Cancel commands
    queuedCommandsRef.current.forEach(cmd => {
      if (cmd.status === 'pending' || cmd.status === 'executing') cmd.status = 'cancelled'
    })
    commandQueueRef.current = []
    isExecutingQueueRef.current = false
    setQueuedCommands(Array.from(queuedCommandsRef.current.values()))

    if (status === AssistantStatus.Listening || status === AssistantStatus.Processing) stopListening()

    addMessage(MessageSender.System, "🚨 EMERGENCY STOP")
  }, [status, stopListening, addMessage])

  // Store emergency stop function globally so emergency stop component can access it
  useEffect(() => {
    ;(globalThis as any).__aiEmergencyStopAll = emergencyStopAll
    return () => {
      delete (globalThis as any).__aiEmergencyStopAll
    }
  }, [emergencyStopAll])

  return { 
    messages, 
    status, 
    useTextInput, 
    setUseTextInput, 
    startListening, 
    stopListening, 
    sendTextMessage,
    queuedCommands,
    cancelQueuedCommand,
    cancelAllQueuedCommands,
    emergencyStopAll,
  }
}

