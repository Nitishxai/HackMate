import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';

function initialsFor(contact) {
  return contact.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function ConversationView({
  contact,
  messages,
  currentUserId,
  loadingMessages,
  sending,
  error,
  onSend,
  onClearError,
}) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    const sent = await onSend(draft);
    if (sent) setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event);
    }
  };

  if (!contact) {
    return (
      <section className="conversation-view conversation-placeholder">
        <div className="messages-placeholder-mark" aria-hidden="true">↗</div>
        <h2>Select a conversation to start messaging.</h2>
        <p>Choose an existing conversation or find a connected teammate to message.</p>
      </section>
    );
  }

  return (
    <section className="conversation-view">
      <header className="conversation-view-header">
        {contact.avatarUrl ? (
          <img className="conversation-avatar" src={contact.avatarUrl} alt="" />
        ) : (
          <span className="conversation-avatar conversation-initials" aria-hidden="true">
            {initialsFor(contact)}
          </span>
        )}
        <div className="conversation-header-copy">
          <h2>{contact.name}</h2>
          <p>{contact.username ? `@${contact.username} · Connected` : 'Connected teammate'}</p>
        </div>
        <span className="connected-indicator">Connected</span>
      </header>

      <div className="message-history" aria-live="polite">
        {loadingMessages ? (
          <p className="message-state">Loading messages...</p>
        ) : messages.length ? (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === currentUserId}
            />
          ))
        ) : (
          <p className="message-state">Start the conversation with {contact.name}.</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="message-error" role="status">{error}</div>}

      <form className="message-composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onClearError}
          placeholder={`Message ${contact.name}…`}
          aria-label={`Message ${contact.name}`}
          rows="2"
        />
        <div className="composer-footer">
          <span>Enter to send · Shift+Enter for a new line</span>
          <button type="submit" className="primary-button" disabled={!draft.trim() || sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ConversationView;
