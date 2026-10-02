import SidebarNav from '../components/SidebarNav';
import TopBar from '../components/TopBar';

function AppShell({
  navItems,
  activePage,
  onSelect,
  profile,
  onLogout,
  searchValue,
  onSearch,
  statusMessage,
  onDismissStatus,
  children,
}) {
  return (
    <div className="app-shell">
      <SidebarNav items={navItems} activePage={activePage} onSelect={onSelect} profile={profile} />
      <div className="content-shell">
        <TopBar onSearch={onSearch} searchValue={searchValue} profile={profile} onLogout={onLogout} />
        <main className="page-container">
          {statusMessage && (
            <div className="form-status-panel app-status-error" data-tone="error" role="alert">
              <span>{statusMessage}</span>
              <button type="button" className="text-button" onClick={onDismissStatus}>Dismiss</button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
