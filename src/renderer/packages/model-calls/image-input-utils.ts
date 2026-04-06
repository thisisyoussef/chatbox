import { svgCodeToBase64, svgToPngBase64 } from '@/packages/pic_utils'

type ParsedDataUrl = {
  isBase64: boolean
  mediaType: string
  payload: string
  decodedPayload: string
}

export type NormalizedImageData = {
  data: string
  dataUrl: string
  mediaType: string
}

function encodeUtf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function parseDataUrl(imageData: string): ParsedDataUrl | null {
  if (!imageData.startsWith('data:')) {
    return null
  }

  const commaIndex = imageData.indexOf(',')
  if (commaIndex < 0) {
    return null
  }

  const header = imageData.slice(0, commaIndex)
  const payload = imageData.slice(commaIndex + 1)
  const isBase64 = /;base64(?:;|$)/i.test(header)
  const mediaType = imageData.match(/^data:([^;,]+)/)?.[1] || 'image/png'

  let decodedPayload = payload
  try {
    decodedPayload = isBase64 ? decodeBase64Utf8(payload) : decodeURIComponent(payload)
  } catch {
    // Keep the original payload when decoding fails.
  }

  return {
    isBase64,
    mediaType,
    payload,
    decodedPayload,
  }
}

export async function normalizeImageDataForModel(imageData: string): Promise<NormalizedImageData> {
  const parsed = parseDataUrl(imageData)
  if (!parsed) {
    return {
      data: imageData,
      dataUrl: imageData,
      mediaType: imageData.match(/^data:([^;,]+)/)?.[1] || 'image/png',
    }
  }

  if (parsed.mediaType === 'image/svg+xml') {
    try {
      const pngDataUrl = await svgToPngBase64(svgCodeToBase64(parsed.decodedPayload))
      const rasterized = parseDataUrl(pngDataUrl)
      if (rasterized) {
        return {
          data: rasterized.payload,
          dataUrl: pngDataUrl,
          mediaType: rasterized.mediaType,
        }
      }
    } catch {
      // Fall through and keep the SVG payload if rasterization fails.
    }
  }

  if (!parsed.isBase64) {
    const data = encodeUtf8ToBase64(parsed.decodedPayload)
    return {
      data,
      dataUrl: `data:${parsed.mediaType};base64,${data}`,
      mediaType: parsed.mediaType,
    }
  }

  return {
    data: parsed.payload,
    dataUrl: imageData,
    mediaType: parsed.mediaType,
  }
}
