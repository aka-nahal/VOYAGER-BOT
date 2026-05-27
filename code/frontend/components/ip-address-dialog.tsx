"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setStoredIpAddress, validateIpAddress, formatIpAddress, getBackendUrl } from "@/lib/ip-storage"

interface IpAddressDialogProps {
  open: boolean
  onConnect: (ip: string) => void
}

export function IpAddressDialog({ open, onConnect }: IpAddressDialogProps) {
  const [ip, setIp] = useState("")
  const [error, setError] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [skipTest, setSkipTest] = useState(false)

  useEffect(() => {
    if (open) {
      setIp("")
      setError("")
      setIsConnecting(false)
      setSkipTest(false)
    }
  }, [open])

  const handleConnect = async () => {
    const cleaned = formatIpAddress(ip)
    
    if (!cleaned) {
      setError("Please enter an IP address")
      return
    }

    if (!validateIpAddress(cleaned)) {
      setError("Invalid IP address format (e.g., 192.168.1.100)")
      return
    }

    // If skip test is enabled, just save the IP
    if (skipTest) {
      setStoredIpAddress(cleaned)
      onConnect(cleaned)
      return
    }

    setIsConnecting(true)
    setError("")

    try {
      // Test connection by trying to fetch health endpoint
      const url = getBackendUrl(cleaned)
      
      // Create timeout controller for better browser compatibility
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(`${url}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`Server returned error: ${response.status}`)
        }

        // Connection successful
        setStoredIpAddress(cleaned)
        onConnect(cleaned)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error("Connection timeout. Check if the robot is running and accessible.")
        }
        throw fetchError
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      
      // Provide more helpful error messages
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("Cannot reach robot. Check:\n• IP address is correct\n• Robot is powered on\n• Both devices are on the same network\n• Firewall allows connections\n\nYou can skip the connection test and save anyway.")
      } else if (errorMessage.includes("timeout")) {
        setError("Connection timeout. The robot may be offline or unreachable.\n\nYou can skip the connection test and save anyway.")
      } else {
        setError(errorMessage)
      }
      
      setIsConnecting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isConnecting) {
      handleConnect()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="w-[95vw] sm:w-[90vw] max-w-md bg-neutral-900 border-neutral-700 text-white [&>button]:hidden mx-2 sm:mx-auto">
        <DialogHeader className="px-1 sm:px-0">
          <DialogTitle className="text-orange-500 text-base sm:text-lg">Connect to Raspberry Pi</DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs sm:text-sm">
            Enter the IP address of your Raspberry Pi robot to connect.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="ip" className="text-neutral-300 text-sm sm:text-base">
              IP Address
            </Label>
            <Input
              id="ip"
              type="text"
              placeholder="192.168.1.100"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value)
                setError("")
              }}
              onKeyPress={handleKeyPress}
              disabled={isConnecting}
              className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus-visible:ring-orange-500 min-h-[44px] text-sm sm:text-base"
              autoFocus
            />
            {error && (
              <p className="text-xs sm:text-sm text-red-500 mt-1 whitespace-pre-line break-words">{error}</p>
            )}
            <p className="text-[10px] sm:text-xs text-neutral-500 mt-2">
              Example: 192.168.1.100 or 10.111.22.6
            </p>
            <div className="flex items-center gap-2 mt-3 touch-manipulation">
              <input
                type="checkbox"
                id="skipTest"
                checked={skipTest}
                onChange={(e) => {
                  setSkipTest(e.target.checked)
                  setError("")
                }}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-neutral-600 bg-neutral-800 text-orange-500 focus:ring-orange-500 touch-manipulation"
              />
              <Label htmlFor="skipTest" className="text-[11px] sm:text-xs text-neutral-400 cursor-pointer">
                Skip connection test (save IP anyway)
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter className="px-1 sm:px-0">
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !ip.trim()}
            className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white w-full sm:w-auto min-h-[44px] px-6 touch-manipulation"
          >
            {isConnecting ? "Connecting..." : skipTest ? "Save IP" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

