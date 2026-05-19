import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.tsx'
import ToastContainer from './components/ToastContainer.tsx'
import Library from './pages/Library.tsx'
import AlbumDetail from './pages/AlbumDetail.tsx'
import Duplicates from './pages/Duplicates.tsx'
import Stats from './pages/Stats.tsx'
import Settings from './pages/Settings.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <Nav />
        <main className="px-6 py-8">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/album/:id" element={<AlbumDetail />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  )
}
