import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import LoginButton from './components/LoginButton.jsx';
import Chat from './components/Chat.jsx';
import AdminPage from './pages/AdminPage.jsx';

export default function App() {
  const { user, loading, signOut } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Image<span>Chat</span>
        </Link>
        <nav className="nav">
          {user && (
            <>
              <Link to="/admin" className="navlink">
                admin
              </Link>
              <button className="linkbtn" onClick={signOut}>
                sair ({user.displayName?.split(' ')[0] || 'você'})
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="main">
        {loading ? (
          <p className="muted center">Carregando…</p>
        ) : (
          <Routes>
            <Route path="/" element={user ? <Chat /> : <LoginButton />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
