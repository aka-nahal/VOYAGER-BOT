"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLiveAssistant, MessageSender, AssistantStatus, QueuedCommand } from "@/hooks/useLiveAssistant"
import { useRobotSocket } from "@/lib/robot-socket"
import { Bot, Mic, MicOff, Keyboard, Volume2, X, Play, Square, Loader2, CheckCircle2, AlertCircle, Radio, Wifi, WifiOff, AlertTriangle } from "lucide-react"
import CameraFeed from "@/components/camera-feed"

const MessageBubble = ({ message }: { message: { id: string; sender: MessageSender; text: string; timestamp: string } }) => {
  const isUser = message.sender === MessageSender.User
  const isSystem = message.sender === MessageSender.System

  if (isSystem) {
    return (
      <div className="flex items-start gap-2 sm:gap-2.5 my-1.5 sm:my-2 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-600/20 border border-red-500/50 flex-shrink-0 animate-pulse">
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1 w-full max-w-[85%] sm:max-w-[320px]">
          <div className="leading-1.5 p-2 sm:p-3 border border-red-500/30 bg-red-950/20 rounded-lg backdrop-blur-sm hover:border-red-500/50 transition-colors">
            <p className="text-xs sm:text-sm font-normal text-red-300 break-words">{message.text}</p>
          </div>
          <span className="text-[10px] sm:text-xs text-neutral-500 ml-1">{message.timestamp}</span>
        </div>
      </div>
    )
  }

  if (message.sender === MessageSender.Assistant) {
    return (
      <div className="flex items-start gap-2 sm:gap-2.5 my-1.5 sm:my-2 animate-in fade-in slide-in-from-left-2 duration-500">
        <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex-shrink-0 shadow-lg hover:scale-110 transition-transform">
          <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white animate-pulse" />
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1 w-full max-w-[85%] sm:max-w-[320px]">
          <div className="leading-1.5 p-2 sm:p-3 border border-orange-500/30 bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-orange-500/20 hover:border-orange-500/50 transition-all">
            <p className="text-xs sm:text-sm font-normal text-neutral-100 break-words">{message.text}</p>
          </div>
          <span className="text-[10px] sm:text-xs text-neutral-400 ml-1">{message.timestamp}</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex items-start gap-2 sm:gap-2.5 my-1.5 sm:my-2 justify-end animate-in fade-in slide-in-from-right-2 duration-500">
      <div className="flex flex-col gap-0.5 sm:gap-1 w-full max-w-[85%] sm:max-w-[320px] items-end">
        <div className="leading-1.5 p-2 sm:p-3 border border-orange-500/40 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg hover:shadow-orange-500/50 hover:scale-[1.02] transition-all">
          <p className="text-xs sm:text-sm font-medium text-white break-words">{message.text}</p>
        </div>
        <span className="text-[10px] sm:text-xs text-neutral-400 mr-1">{message.timestamp}</span>
      </div>
      <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-neutral-700/70 to-neutral-800/70 border border-neutral-600 flex-shrink-0 hover:scale-110 transition-transform">
        <Mic className="h-3 w-3 text-white" />
      </div>
    </div>
  )
}

const CommandQueueItem = ({ command, onCancel }: { command: QueuedCommand; onCancel: () => void }) => {
  const getStatusConfig = () => {
    switch (command.status) {
      case 'pending':
        return {
          color: 'text-yellow-400',
          bg: 'bg-yellow-950/20 border-yellow-500/30',
          icon: <Play className="h-3 w-3" />,
          pulse: false
        }
      case 'executing':
        return {
          color: 'text-blue-400',
          bg: 'bg-blue-950/20 border-blue-500/30',
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          pulse: true
        }
      case 'completed':
        return {
          color: 'text-green-400',
          bg: 'bg-green-950/20 border-green-500/30',
          icon: <CheckCircle2 className="h-3 w-3" />,
          pulse: false
        }
      case 'cancelled':
        return {
          color: 'text-neutral-500',
          bg: 'bg-neutral-900/50 border-neutral-700/30',
          icon: <X className="h-3 w-3" />,
          pulse: false
        }
      case 'error':
        return {
          color: 'text-red-400',
          bg: 'bg-red-950/20 border-red-500/30',
          icon: <AlertCircle className="h-3 w-3" />,
          pulse: false
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg border transition-all duration-300 ${
      config.bg
    } ${command.status === 'cancelled' ? 'opacity-50' : ''} ${
      config.pulse ? 'animate-pulse' : ''
    } animate-in fade-in slide-in-from-left-2 hover:scale-[1.02] hover:shadow-md`}>
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0">
        <span className={`${config.color} flex-shrink-0 ${command.status === 'executing' ? 'animate-bounce' : ''}`}>{config.icon}</span>
        <span className={`text-[10px] sm:text-xs font-medium truncate ${config.color}`}>
          {command.displayText}
        </span>
      </div>
      {(command.status === 'pending' || command.status === 'executing') && (
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-7 w-7 sm:h-6 sm:w-6 p-0 hover:bg-red-900/30 hover:scale-110 flex-shrink-0 transition-all touch-manipulation"
          title={command.status === 'executing' ? "Stop and cancel command" : "Cancel command"}
        >
          <X className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-red-400" />
        </Button>
      )}
    </div>
  )
}

export default function AIPage() {
  const { 
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
  } = useLiveAssistant()
  const { connected, emergencyStop } = useRobotSocket()
  const [textInput, setTextInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""

  const handleEmergencyStop = () => {
    // Stop robot motors and navigation
    emergencyStop()
    // Stop AI assistant systems (helicopter mode, audio, commands, listening)
    emergencyStopAll()
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleMicClick = () => {
    if (status === AssistantStatus.Listening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendTextMessage(textInput)
    setTextInput("")
  }

  const getStatusConfig = () => {
    switch (status) {
      case AssistantStatus.Ready:
        return {
          text: "READY",
          color: "bg-green-500",
          icon: <Radio className="h-3 w-3" />,
          pulse: false
        }
      case AssistantStatus.Listening:
        return {
          text: "LISTENING",
          color: "bg-red-500",
          icon: <Mic className="h-3 w-3" />,
          pulse: true
        }
      case AssistantStatus.Processing:
        return {
          text: "PROCESSING",
          color: "bg-yellow-500",
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          pulse: false
        }
      case AssistantStatus.Error:
        return {
          text: "ERROR",
          color: "bg-red-500",
          icon: <AlertCircle className="h-3 w-3" />,
          pulse: false
        }
    }
  }

  if (!apiKey) {
    return (
      <div className="px-2 py-2 sm:px-4 sm:py-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 md:ml-64">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-300">Gemini API Key Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-neutral-400">
                Please configure your Gemini API key in the <code className="text-orange-500">.env.local</code> file.
              </p>
              <div className="bg-neutral-800 border border-neutral-700 rounded p-3 font-mono text-xs text-neutral-300">
                NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
              </div>
              <p className="text-xs text-neutral-500">
                Get your API key from{" "}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                After adding the key, restart your development server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 md:ml-64">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Voice Assistant Panel */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 flex flex-col h-[calc(100dvh-140px)] sm:h-[calc(100dvh-180px)] md:h-[calc(100dvh-220px)] shadow-xl max-h-[calc(100dvh-140px)] sm:max-h-[calc(100dvh-180px)] md:max-h-[calc(100dvh-220px)]">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider flex items-center gap-1.5 sm:gap-2">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                <span className="truncate">VOICE ASSISTANT</span>
              </CardTitle>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {connected ? (
                  <Badge variant="outline" className="border-green-500/50 text-green-400 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    <Wifi className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    <span className="hidden min-[375px]:inline">Connected</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/50 text-red-400 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    <WifiOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    <span className="hidden min-[375px]:inline">Disconnected</span>
                  </Badge>
                )}
                <Button
                  onClick={handleEmergencyStop}
                  variant="outline"
                  size="sm"
                  className="h-6 sm:h-7 px-1.5 sm:px-2 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all touch-manipulation flex-shrink-0"
                  title="Emergency Stop - Stop everything"
                >
                  <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-700/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-neutral-600/50">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Command Queue */}
            {queuedCommands.length > 0 && (
              <div className="border-t border-neutral-700/50 p-2 sm:p-3 bg-gradient-to-b from-neutral-800/50 to-neutral-900/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2 sm:mb-2.5 gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-[10px] sm:text-xs font-semibold text-neutral-300 truncate">Command Queue</span>
                    <Badge variant="outline" className="border-neutral-600 text-neutral-400 text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 flex-shrink-0">
                      {queuedCommands.length}
                    </Badge>
                  </div>
                  {queuedCommands.some(cmd => cmd.status === 'pending' || cmd.status === 'executing') && (
                    <Button
                      onClick={cancelAllQueuedCommands}
                      variant="ghost"
                      size="sm"
                      className="h-6 sm:h-7 px-2 sm:px-2.5 text-[10px] sm:text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors flex-shrink-0 touch-manipulation"
                      title="Cancel all pending and executing commands"
                    >
                      <Square className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      <span className="hidden sm:inline">Cancel All</span>
                      <span className="sm:hidden">Cancel</span>
                    </Button>
                  )}
                </div>
                <div className="space-y-1 sm:space-y-1.5 max-h-32 sm:max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-600/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-neutral-500/40">
                  {queuedCommands.map((cmd) => (
                    <CommandQueueItem
                      key={cmd.id}
                      command={cmd}
                      onCancel={() => cancelQueuedCommand(cmd.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <div className="border-t border-neutral-700/50 p-3 sm:p-4 bg-neutral-900/50 backdrop-blur-sm">
              <div className="w-full flex items-center justify-center mb-3 sm:mb-4">
                <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors touch-manipulation">
                  <input
                    type="checkbox"
                    id="text-input-toggle"
                    className="w-4 h-4 sm:w-4 sm:h-4 rounded border-neutral-600 bg-neutral-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-neutral-900 touch-manipulation"
                    checked={useTextInput}
                    onChange={(e) => setUseTextInput(e.target.checked)}
                  />
                  <Keyboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">Text Input</span>
                </label>
              </div>
              {useTextInput ? (
                <form onSubmit={handleTextSubmit} className="w-full">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your command..."
                      className="flex-1 bg-neutral-800/80 border-neutral-700/50 text-white placeholder:text-neutral-500 focus:border-orange-500/50 focus:ring-orange-500/20 text-sm sm:text-base min-h-[44px]"
                      disabled={status === AssistantStatus.Processing}
                    />
                    <Button
                      type="submit"
                      disabled={!textInput.trim() || status === AssistantStatus.Processing}
                      className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 px-4 sm:px-6 touch-manipulation min-w-[60px] sm:min-w-[80px] min-h-[44px]"
                    >
                      Send
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Quick Fun Commands */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
                    <Button
                      onClick={() => sendTextMessage("dance")}
                      disabled={!connected || status === AssistantStatus.Processing}
                      className="h-10 sm:h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 hover:from-purple-500/40 hover:to-purple-600/40 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 hover:text-purple-200 transition-all hover:scale-105 active:scale-95"
                      title="Dance Mode"
                    >
                      <span className="text-lg sm:text-xl">💃</span>
                    </Button>
                    <Button
                      onClick={() => sendTextMessage("patrol")}
                      disabled={!connected || status === AssistantStatus.Processing}
                      className="h-10 sm:h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/40 hover:to-blue-600/40 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 transition-all hover:scale-105 active:scale-95"
                      title="Patrol Mode"
                    >
                      <span className="text-lg sm:text-xl">🎯</span>
                    </Button>
                    <Button
                      onClick={() => sendTextMessage("celebrate")}
                      disabled={!connected || status === AssistantStatus.Processing}
                      className="h-10 sm:h-12 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 hover:from-yellow-500/40 hover:to-yellow-600/40 border border-yellow-500/30 hover:border-yellow-500/50 text-yellow-300 hover:text-yellow-200 transition-all hover:scale-105 active:scale-95"
                      title="Celebrate"
                    >
                      <span className="text-lg sm:text-xl">🎉</span>
                    </Button>
                    <Button
                      onClick={() => sendTextMessage("helicopter")}
                      disabled={!connected || status === AssistantStatus.Processing}
                      className="h-10 sm:h-12 bg-gradient-to-br from-green-500/20 to-green-600/20 hover:from-green-500/40 hover:to-green-600/40 border border-green-500/30 hover:border-green-500/50 text-green-300 hover:text-green-200 transition-all hover:scale-105 active:scale-95"
                      title="Helicopter Mode"
                    >
                      <span className="text-lg sm:text-xl">🚁</span>
                    </Button>
                  </div>

                  <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-2">
                      <Button
                        onClick={handleMicClick}
                        disabled={!connected}
                        className={`h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg touch-manipulation min-h-[80px] min-w-[80px] sm:min-h-[96px] sm:min-w-[96px] ${
                          status === AssistantStatus.Listening
                            ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800 animate-pulse scale-105"
                            : "bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:from-orange-700 active:to-orange-800 active:scale-95"
                        } ${!connected ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {status === AssistantStatus.Listening ? (
                          <MicOff className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        ) : (
                          <Mic className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        )}
                      </Button>
                      {status === AssistantStatus.Listening && (
                        <Button
                          onClick={stopListening}
                          variant="outline"
                          size="sm"
                          className="h-9 sm:h-9 px-3 sm:px-4 text-[10px] sm:text-xs border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 active:bg-red-600 transition-all touch-manipulation min-h-[44px] animate-in fade-in slide-in-from-right-2 hover:scale-105"
                        >
                          <Square className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5 animate-pulse" />
                          Stop
                        </Button>
                      )}
                    </div>
                    {(() => {
                      const statusConfig = getStatusConfig()
                      return (
                        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-neutral-800/70 to-neutral-900/70 border border-neutral-700/50 shadow-lg backdrop-blur-sm hover:border-neutral-600/70 transition-all">
                          <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''} shadow-lg`}></span>
                          <span className="text-[10px] sm:text-xs font-semibold text-neutral-200 flex items-center gap-1 sm:gap-1.5">
                            <span className="scale-90 sm:scale-100">{statusConfig.icon}</span>
                            {statusConfig.text}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Camera Feed */}
        <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-xl">
          <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
              CAMERA FEED
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CameraFeed />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
