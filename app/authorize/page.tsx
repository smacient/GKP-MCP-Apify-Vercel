import { Suspense } from 'react'
import McpAuthClient from './mcpauthclient'

export default function AuthorizePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <McpAuthClient />
    </Suspense>
  )
}
