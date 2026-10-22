import { Outlet } from 'react-router-dom'
import { CallProvider } from '../calls'
import TopBar from './TopBar'

export default function Shell() {
  return (
    <CallProvider>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <TopBar />
        <main className="flex-1 px-4 pb-safe pt-4"><Outlet /></main>
      </div>
    </CallProvider>
  )
}
