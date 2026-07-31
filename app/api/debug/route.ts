import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GEMINI_API_KEY

  let geminiStatus = 'not_tested'
  let geminiResponse = ''

  if (key) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'responda: ok' }] }] })
        }
      )
      const data = await res.json()
      geminiStatus = res.ok ? 'ok' : `error_${res.status}`
      geminiResponse = res.ok
        ? (data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'sem texto')
        : (data.error?.message ?? JSON.stringify(data)).slice(0, 200)
    } catch (e) {
      geminiStatus = 'fetch_error'
      geminiResponse = String(e)
    }
  }

  return NextResponse.json({
    version: 'v6',
    gemini_key_prefix: key ? key.slice(0, 12) : 'UNDEFINED',
    gemini_key_length: key?.length ?? 0,
    gemini_status: geminiStatus,
    gemini_response: geminiResponse,
  })
}
