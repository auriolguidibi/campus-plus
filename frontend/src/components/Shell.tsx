import { Outlet, useLocation } from 'react-router-dom'
import { CallProvider } from '../calls'
import DesktopTopBar from './DesktopTopBar'
import RightRail from './RightRail'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/** Phones/tablets: single top bar + page. Desktop (lg+): left sidebar, top search bar, centre column and (home) right rail. */
export default function Shell() {
  const home = useLocation().pathname === '/'
  return (
    <CallProvider>
      <div className="mx-auto min-h-dvh max-w-xl lg:grid lg:max-w-[1360px] lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:px-6">
        <Sidebar />
        <div className="min-w-0">
          <div className="lg:hidden"><TopBar /></div>
          <DesktopTopBar />
          <div className={home ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start lg:gap-8' : ''}>
            <main className="min-w-0 px-4 pb-safe pt-4 lg:pt-2"><Outlet /></main>
            {home && <RightRail />}
          </div>
        </div>
      </div>
    </CallProvider>
  )
}
