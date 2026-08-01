export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return Response.json(
        { error: "imageUrl is required" },
        { status: 400 }
      )
    }

    // Fetch from the external API (server-side, no CORS issues)
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Return as base64
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return Response.json({ base64, mimeType: blob.type })
  } catch (error) {
    console.error("Proxy error:", error)
    return Response.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    )
  }
}
