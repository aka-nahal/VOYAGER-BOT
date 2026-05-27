"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Image as ImageIcon, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { getBackendUrl } from "@/lib/ip-storage"
import { useToast } from "@/hooks/use-toast"

interface CustomColorUploadProps {
  connected: boolean
  onColorExtracted?: () => void
}

export default function CustomColorUpload({ connected, onColorExtracted }: CustomColorUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedColor, setExtractedColor] = useState<{
    dominant_bgr: [number, number, number]
    dominant_hsv: [number, number, number]
    hsv_min: number[]
    hsv_max: number[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive"
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Convert to base64 and send to backend
    setUploading(true)
    setExtractedColor(null)

    try {
      const base64 = await fileToBase64(file)

      // Send to backend
      const backendUrl = getBackendUrl()
      const response = await fetch(`${backendUrl}/api/color/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to extract color: ${response.statusText}`)
      }

      const data = await response.json()
      setExtractedColor(data.color_data)

      toast({
        title: "Success!",
        description: "Custom color extracted and set for tracking",
        variant: "default"
      })

      onColorExtracted?.()

    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to extract color from image",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleClear = () => {
    setPreview(null)
    setExtractedColor(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const rgbToHex = (r: number, g: number, b: number) => {
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
  }

  return (
    <Card className="bg-neutral-900/95 backdrop-blur-sm border-neutral-700/50 shadow-lg card-hover">
      <CardHeader className="pb-2 sm:pb-3 border-b border-neutral-700/50 px-3 sm:px-4 py-2 sm:py-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
          CUSTOM COLOR
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={!connected || uploading}
        />

        <Button
          onClick={handleUploadClick}
          disabled={!connected || uploading}
          className="w-full text-xs sm:text-sm py-2.5 sm:py-2 h-auto min-h-[44px] touch-manipulation transition-all duration-200 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting Color...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </>
          )}
        </Button>

        {/* Preview and Color Info */}
        {preview && (
          <div className="space-y-2">
            {/* Image Preview */}
            <div className="relative rounded-lg overflow-hidden border-2 border-neutral-700">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-32 object-cover"
              />
              {extractedColor && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500 bg-black/50 rounded-full p-1" />
                </div>
              )}
            </div>

            {/* Extracted Color Display */}
            {extractedColor && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-neutral-600 shadow-lg"
                    style={{
                      backgroundColor: rgbToHex(
                        extractedColor.dominant_bgr[2],
                        extractedColor.dominant_bgr[1],
                        extractedColor.dominant_bgr[0]
                      )
                    }}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">RGB:</span>
                      <span className="text-white font-mono">
                        {extractedColor.dominant_bgr[2]}, {extractedColor.dominant_bgr[1]}, {extractedColor.dominant_bgr[0]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">HSV:</span>
                      <span className="text-white font-mono">
                        {extractedColor.dominant_hsv[0]}, {extractedColor.dominant_hsv[1]}, {extractedColor.dominant_hsv[2]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-800/50 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">HSV Min:</span>
                    <span className="text-neutral-200 font-mono text-[10px]">
                      [{extractedColor.hsv_min.join(", ")}]
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">HSV Max:</span>
                    <span className="text-neutral-200 font-mono text-[10px]">
                      [{extractedColor.hsv_max.join(", ")}]
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="w-full text-xs py-2 h-auto bg-neutral-800/50 border-neutral-600 hover:bg-neutral-700/50"
                >
                  <XCircle className="mr-2 h-3 w-3" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}

        {!preview && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <ImageIcon className="h-8 w-8 text-neutral-600" />
            <p className="text-xs text-neutral-500">
              Upload an image to extract and track its dominant color
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
