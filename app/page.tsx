'use client'

import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    console.log('Hello Vercel MCP! Page loaded successfully.')
  }, [])

  return (
    <main className="container">
      <div className="content">
        <h1>Hello Vercel MCP!</h1>
        <p>This is a simple test project deployed via Vercel MCP.</p>
        <div className="info">
          <h2>Project Info</h2>
          <ul>
            <li>Framework: Next.js 14</li>
            <li>Deployed using: Vercel MCP</li>
            <li>Status: ✅ Live and working!</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
