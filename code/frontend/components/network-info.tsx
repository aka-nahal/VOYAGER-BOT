"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Check } from "lucide-react"
import { getNetworkIP } from "@/lib/network-utils"

export default function NetworkInfo() {
  const [localIp, setLocalIp] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [port, setPort] = useState(3000)

  useEffect(() => {
    // Get port from window location
    if (typeof window !== 'undefined') {
      setPort(window.location.port ? parseInt(window.location.port) : 3000)
    }

    // Detect local IP
    getNetworkIP().then((ip) => {
      if (ip) {
        setLocalIp(ip)
      }
    })
  }, [])

  const connectionUrl = localIp ? `http://${localIp}:${port}` : null

  const copyToClipboard = () => {
    if (connectionUrl) {
      navigator.clipboard.writeText(connectionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!connectionUrl) return null

  return (
    <Card className="bg-neutral-900 border-neutral-700 fixed top-4 right-4 z-50 max-w-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs">NETWORK ACCESS</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <span className="text-neutral-500">Connect from other devices:</span>
        </div>
        <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 px-2 py-1 rounded">
          <code className="text-green-400 font-mono text-xs flex-1 break-all">
            {connectionUrl}
          </code>
          <button
            onClick={copyToClipboard}
            className="text-neutral-400 hover:text-white transition-colors p-1"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-neutral-500 text-[10px]">
          Share this URL with devices on the same WiFi network
        </div>
      </CardContent>
    </Card>
  )
}

