import { useEffect, useState } from 'react';
import './App.css';
import { navItems } from './data/mockData';
import { useAuth } from './hooks/useAuth';
import { logoutCometChat, useCometChatSession } from './hooks/useCometChat';
import { useProfile } from './hooks/useProfile';
import { useProjects } from './hooks/useProjects';
import AppShell from './layouts/AppShell';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import DiscoverPage from './pages/DiscoverPage';
import ProjectsPage from './pages/ProjectsPage';
import MessagesPage from './pages/MessagesPage';
import MyTeamPage from './pages/MyTeamPage';
import ProfilePage from './pages/ProfilePage';
import { CometChatProvider } from '@cometchat/chat-uikit-react';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageUser, setSelectedMessageUser] = useState(null);
  const { session, authLoading, authError, signIn, signUp, signOut } = useAuth();
  const { profile, loading, saving, error, saveMessage, updateProfile } = useProfile(session);
  const cometchat = useCometChatSession(session, profile?.name, authLoading);
  const projectData = useProjects(session);
  const [logoutError, setLogoutError] = useState('');
  const [theme, setTheme] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logoutCometChat();
      await signOut();
    } catch (caughtError) {
      setLogoutError(caughtError?.message || 'Unable to sign out. Please try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="brand-mark">H</div>
          <p>Loading HackMate…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onLogin={signIn} onSignUp={signUp} authError={authError} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'discover':
        return (
          <DiscoverPage
            profile={profile}
            projectData={projectData}
            session={session}
            searchQuery={searchQuery}
            onSearch={(event) => setSearchQuery(event.target.value)}
            onNavigate={setActivePage}
            onMessage={(userId) => {
              setSelectedMessageUser({ userId, ownerId: session.user.id });
              setActivePage('messages');
            }}
          />
        );
      case 'projects':
        return (
          <ProjectsPage
            profile={profile}
            projectData={projectData}
            session={session}
            searchQuery={searchQuery}
            onMessage={(userId) => {
              setSelectedMessageUser({ userId, ownerId: session.user.id });
              setActivePage('messages');
            }}
          />
        );
      case 'messages':
        return (
          <MessagesPage
            session={session}
            cometchat={cometchat}
            selectedUserId={
              selectedMessageUser?.ownerId === session.user.id
                ? selectedMessageUser.userId
                : null
            }
            onSelectUser={(userId) => setSelectedMessageUser({ userId, ownerId: session.user.id })}
            onFindTeammates={() => setActivePage('discover')}
          />
        );
      case 'team':
        return (
          <MyTeamPage
            profile={profile}
            projectData={projectData}
            session={session}
            onNavigate={setActivePage}
            onMessage={(userId) => {
              setSelectedMessageUser({ userId, ownerId: session.user.id });
              setActivePage('messages');
            }}
          />
        );
      case 'profile':
        return (
          <ProfilePage
            profile={profile}
            projectData={projectData}
            session={session}
            onSaveProfile={updateProfile}
            loading={loading}
            saving={saving}
            error={error}
            saveMessage={saveMessage}
            onNavigate={setActivePage}
            onMessage={(userId) => {
              setSelectedMessageUser({ userId, ownerId: session.user.id });
              setActivePage('messages');
            }}
          />
        );
      case 'dashboard':
        return (
          <DashboardPage
            profile={profile}
            projectData={projectData}
            session={session}
            onNavigate={setActivePage}
            onMessage={(userId) => {
              setSelectedMessageUser({ userId, ownerId: session.user.id });
              setActivePage('messages');
            }}
          />
        );
      case 'home':
      default:
        return <LandingPage onNavigate={setActivePage} />;
    }
  };

  const appShell = (
    <AppShell
      navItems={navItems}
      activePage={activePage}
      onSelect={setActivePage}
      profile={profile}
      onLogout={handleLogout}
      searchValue={searchQuery}
      onSearch={(event) => setSearchQuery(event.target.value)}
      statusMessage={logoutError}
      onDismissStatus={() => setLogoutError('')}
    >
      {renderPage()}
    </AppShell>
  );

  return cometchat.status === 'ready' ? (
    <CometChatProvider theme={theme}>{appShell}</CometChatProvider>
  ) : appShell;
}

export default App;
