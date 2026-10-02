function TopBar({ onSearch, searchValue = '', profile, onLogout }) {
  const name = profile?.name || 'HackMate member';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'HM';

  return (
    <header className="topbar">
      <label className="search-box" aria-label="Search">
        <span className="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4.3 4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input type="text" placeholder="Search" value={searchValue} onChange={onSearch} />
      </label>

      <div className="topbar-actions">
        <button type="button" className="notification-button" aria-label="Notifications">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M6 14.5V10a6 6 0 1 1 12 0v4.5l1.7 3H4.3l1.7-3zM10 18.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="notification-pill">3</span>
        </button>

        <button type="button" className="avatar-button" aria-label="User profile">
          <span className="avatar-badge">{initials}</span>
          <span className="user-status-dot" aria-hidden="true" />
        </button>

        {onLogout && (
          <button type="button" className="logout-button" onClick={onLogout}>
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

export default TopBar;
