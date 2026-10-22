import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import { Spinner } from './components/ui'
import { useAuth } from './auth'
import { Forgot, Login, Register, Welcome } from './pages/Auth'
import Feed from './pages/Feed'
import Create from './pages/Create'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Notifications from './pages/Notifications'
import Market from './pages/Market'
import { ChallengePage, Challenges } from './pages/Challenges'
import Confessions from './pages/Confessions'
import { EventForm, EventPage, Events } from './pages/Events'
import Leaderboard from './pages/Leaderboard'
import ListingForm from './pages/ListingForm'
import ListingPage from './pages/ListingPage'
import MyMarket from './pages/MyMarket'
import { Conversations, Thread } from './pages/Messages'
import Communities from './pages/Communities'
import CommunityPage from './pages/CommunityPage'
import Friends from './pages/Friends'
import UserProfile from './pages/UserProfile'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/mot-de-passe-oublie" element={<Forgot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Feed />} />
        <Route path="creer" element={<Create />} />
        <Route path="profil" element={<Profile />} />
        <Route path="communautes" element={<Communities />} />
        <Route path="communautes/:id" element={<CommunityPage />} />
        <Route path="amis" element={<Friends />} />
        <Route path="u/:username" element={<UserProfile />} />
        <Route path="marketplace" element={<Market />} />
        <Route path="marketplace/nouveau" element={<ListingForm />} />
        <Route path="marketplace/mes-annonces" element={<MyMarket />} />
        <Route path="marketplace/:id" element={<ListingPage />} />
        <Route path="marketplace/:id/modifier" element={<ListingForm />} />
        <Route path="defis" element={<Challenges />} />
        <Route path="defis/:id" element={<ChallengePage />} />
        <Route path="confessions" element={<Confessions />} />
        <Route path="evenements" element={<Events />} />
        <Route path="evenements/nouveau" element={<EventForm />} />
        <Route path="evenements/:id" element={<EventPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
        <Route path="classement" element={<Leaderboard />} />
        <Route path="messages" element={<Conversations />} />
        <Route path="messages/:id" element={<Thread />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
