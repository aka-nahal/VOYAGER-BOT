// Audio utilities for Gemini Live API

// Optimized encode using modern APIs
export function encode(bytes: Uint8Array): string {
  const chunkSize = 0x8000 // Process in 32KB chunks for better performance
  const len = bytes.length
  let result = ''

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    result += String.fromCharCode.apply(null, Array.from(chunk))
  }

  return btoa(result)
}

// Optimized decode
export function decode(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)

  // Batch processing for better performance
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

// Optimized PCM conversion
export function createPcmBlob(inputData: Float32Array) {
  const len = inputData.length
  const int16 = new Int16Array(len)

  // Vectorized conversion for better performance
  for (let i = 0; i < len; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  }
}

// Optimized audio decoding
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer)
  const frameCount = Math.floor(dataInt16.length / numChannels)
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate)
  const scale = 1 / 32768.0

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel)
    const offset = channel

    // Optimized deinterleaving with pre-calculated scale
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + offset] * scale
    }
  }

  return buffer
}





