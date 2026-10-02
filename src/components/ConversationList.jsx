function initialsFor(contact) {
  return contact.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatConversationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationList({ conversations, selectedUserId, onSelect }) {
  return (
    <aside className="conversation-list" aria-label="Conversations">
      <header className="conversation-list-header">
        <h2>Messages</h2>
        <span>{conversations.length}</span>
      </header>
      {conversations.length ? (
        <div className="conversation-items">
          {conversations.map(({ contact, latestMessage }) => (
            <button
              type="button"
              className={`conversation-item ${selectedUserId === contact.id ? 'selected' : ''}`}
              key={contact.id}
              onClick={() => onSelect(contact.id)}
            >
              {contact.avatarUrl ? (
                <img className="conversation-avatar" src={contact.avatarUrl} alt="" />
              ) : (
                <span className="conversation-avatar conversation-initials" aria-hidden="true">
                  {initialsFor(contact)}
                </span>
              )}
              <span className="conversation-item-copy">
                <span className="conversation-name">{contact.name}</span>
                <span className="conversation-preview">{latestMessage.content}</span>
              </span>
              <span className="conversation-time">{formatConversationTime(latestMessage.createdAt)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="conversation-list-empty">No conversations yet.</p>
      )}
    </aside>
  );
}

export default ConversationList;
