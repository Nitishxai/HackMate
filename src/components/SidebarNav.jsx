const navIcons = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V18a2 2 0 0 1-2 2h-3.5v-6h-5v6H6a2 2 0 0 1-2-2v-7.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m15.8 8.2-2.2 6.6-6.6 2.2 2.2-6.6 6.6-2.2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l1.5 2H17.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H10l-4.5 3v-3.5A2.5 2.5 0 0 1 5 13.5v-6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.8 18c.6-2.2 2.8-3.5 5.2-3.5s4.6 1.3 5.2 3.5m5.8-2.5c-.4-1.7-2-3-3.9-3-1.3 0-2.5.7-3.1 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 18.5c1.1-2.5 3.3-4 7-4s5.9 1.5 7 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

function SidebarNav({ items, activePage, onSelect, profile }) {
  const name = profile?.name || 'HackMate member';
  const role = profile?.role || 'Add your role';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'HM';

  const compactRole = role.split(' ').slice(0, 2).join(' ');

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">H</div>
        <div>
          <div className="brand-name">HackMate</div>
          <div className="brand-tag">Find the skill. Find the teammate. Build.</div>
        </div>
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {navIcons[item.id]}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="profile-mini-card">
          <div className="mini-avatar">{initials}</div>
          <div>
            <div className="mini-name">{name}</div>
            <div className="mini-meta">{compactRole}</div>
          </div>
          <span className="online-indicator" aria-label="Online" />
        </div>

        <button type="button" className="settings-button">
          Settings
        </button>
      </div>
    </aside>
  );
}

export default SidebarNav;
