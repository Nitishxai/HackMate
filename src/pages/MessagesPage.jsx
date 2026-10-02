import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  CometChatErrorBoundary,
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatSearch,
  CometChatThreadHeader,
} from '@cometchat/chat-uikit-react';
import ConversationList from '../components/ConversationList';
import ConversationView from '../components/ConversationView';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useMessages } from '../hooks/useMessages';

class MessagesPageErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('HackMate Messages route failed to render.', {
        message: getSafeDeveloperMessage(error),
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    const { error } = this.state;
    const { session, cometchat, selectedUserId, onSelectUser, onFindTeammates } = this.props;

    if (error) {
      const developerMessage = getSafeDeveloperMessage(error);
      return (
        <div className="page messages-home-page">
          <div className="form-status-panel" data-tone="error" role="alert">
            <span>Unable to connect to CometChat. Your existing Supabase messages are available below.</span>
            {import.meta.env.DEV && developerMessage && (
              <details>
                <summary>Developer error</summary>
                <code>{developerMessage}</code>
              </details>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => this.setState({ error: null })}
            >
              Retry CometChat
            </button>
          </div>
          <SupabaseMessages
            session={session}
            selectedUserId={selectedUserId}
            onSelectUser={onSelectUser}
            onFindTeammates={onFindTeammates}
          />
        </div>
      );
    }

    return (
      <MessagesPageContent
        session={session}
        cometchat={cometchat}
        selectedUserId={selectedUserId}
        onSelectUser={onSelectUser}
        onFindTeammates={onFindTeammates}
      />
    );
  }
}

function getSafeDeveloperMessage(error) {
  if (typeof error?.message !== 'string') return '';

  let message = error.message;
  for (const secret of [
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  ]) {
    if (secret) message = message.split(secret).join('[redacted]');
  }
  return message.slice(0, 300);
}

function MessagesPage(props) {
  return <MessagesPageErrorBoundary {...props} />;
}

function MessagesPageContent({ session, cometchat, selectedUserId, onSelectUser, onFindTeammates }) {
  const [useSupabaseFallback, setUseSupabaseFallback] = useState(false);
  const showCometChat = cometchat.status === 'ready' && !useSupabaseFallback;

  return (
    <div className="page messages-home-page">
      <section className="section-block compact messages-phase-header">
        <div>
          <div className="eyebrow">Messages</div>
          <h2>Connected teammates</h2>
          <p className="section-subtitle">
            Private messages are available for accepted HackMate connections.
          </p>
        </div>
        {cometchat.status === 'ready' && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => setUseSupabaseFallback((current) => !current)}
          >
            {useSupabaseFallback ? 'Use CometChat' : 'Use Supabase fallback'}
          </button>
        )}
      </section>

      {cometchat.status === 'loading' && (
        <div className="form-status-panel" role="status">
          Connecting CometChat. Your existing Supabase messages remain available below.
        </div>
      )}
      {cometchat.status === 'error' && (
        <div className="form-status-panel" data-tone="error">
          <span>Unable to connect to CometChat.</span>
          {import.meta.env.DEV && cometchat.error && (
            <details>
              <summary>Developer error</summary>
              <code>{getSafeDeveloperMessage({ message: cometchat.error })}</code>
            </details>
          )}
          <button type="button" className="text-button" onClick={cometchat.retry}>
            Retry CometChat
          </button>
        </div>
      )}
      {cometchat.status === 'ready' && cometchat.error && (
        <div className="form-status-panel" data-tone="error">
          <span>CometChat is connected, but the profile name could not be synchronized.</span>
          {import.meta.env.DEV && (
            <details>
              <summary>Developer error</summary>
              <code>{getSafeDeveloperMessage({ message: cometchat.error })}</code>
            </details>
          )}
          <button type="button" className="text-button" onClick={cometchat.retry}>
            Retry
          </button>
        </div>
      )}
      {showCometChat ? (
        <CometChatMessages
          session={session}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          onFindTeammates={onFindTeammates}
        />
      ) : (
        <SupabaseMessages
          session={session}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
          onFindTeammates={onFindTeammates}
        />
      )}
    </div>
  );
}

function CometChatMessages({ session, selectedUserId, onSelectUser, onFindTeammates }) {
  const [userLoadState, setUserLoadState] = useState({
    userId: '',
    user: null,
    loading: false,
    error: '',
  });
  const [panelSelection, setPanelSelection] = useState(null);
  const [messageSelection, setMessageSelection] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const {
    connections,
    profilesByUserId,
    loading: connectionsLoading,
    error: connectionsError,
    reload: reloadConnections,
  } = useConnectionRequests(session);
  const currentUserId = session?.user?.id;
  const contacts = useMemo(
    () => connections.map((connection) => {
      const contactId = connection.senderId === currentUserId
        ? connection.receiverId
        : connection.senderId;
      const profile = profilesByUserId[contactId];

      return {
        id: contactId,
        name: profile?.name || 'HackMate member',
        avatarUrl: profile?.avatar_url || '',
      };
    }).filter((contact) => contact.id),
    [connections, currentUserId, profilesByUserId],
  );
  const activeContact = contacts.find((contact) => contact.id === selectedUserId) || null;
  const activeContactId = activeContact?.id;
  const sidePanel = panelSelection?.userId === activeContactId ? panelSelection : null;
  const goToMessageId = messageSelection && messageSelection.userId === activeContactId
    ? messageSelection.messageId
    : undefined;
  const invalidContactUid = Boolean(
    activeContactId && !/^[A-Za-z0-9-]{1,100}$/.test(activeContactId),
  );
  const selectedCometChatUser = userLoadState.userId === activeContactId
    ? userLoadState.user
    : null;
  const loadingUser = Boolean(activeContactId) &&
    !invalidContactUid &&
    (userLoadState.userId !== activeContactId || userLoadState.loading);
  const userError = invalidContactUid
    ? 'This connected teammate does not have a valid CometChat UID.'
    : userLoadState.userId === activeContactId
      ? userLoadState.error
      : '';

  useEffect(() => {
    if (!activeContactId || invalidContactUid) return undefined;

    let isMounted = true;
    void CometChat.getUser(activeContactId)
      .then((user) => {
        if (isMounted) {
          setUserLoadState({
            userId: activeContactId,
            user,
            loading: false,
            error: '',
          });
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        const isMissingUser = error?.code === 'ERR_UID_NOT_FOUND';
        setUserLoadState({
          userId: activeContactId,
          user: null,
          loading: false,
          error: isMissingUser
            ? 'This teammate has not initialized their CometChat account yet.'
            : error?.message || 'Unable to open this CometChat conversation.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [activeContactId, invalidContactUid, loadAttempt]);

  const handleComponentError = useCallback((error) => {
    setUserLoadState((current) => ({
      ...current,
      error: error?.message || 'CometChat could not load this conversation.',
    }));
  }, []);

  const isMobile = useIsMobile();
  const hasSelection = Boolean(activeContact && selectedCometChatUser);
  const showContactList = !isMobile || !selectedUserId;
  const showMessagePane = !isMobile || (selectedUserId && !sidePanel);
  const showSidePanel = Boolean(sidePanel) && hasSelection;

  return (
    <section className="cometchat-messages-shell">
      {connectionsError && (
        <div className="form-status-panel" data-tone="error">
          <span>Unable to load connected teammates.</span>
          <button type="button" className="text-button" onClick={() => void reloadConnections()}>
            Retry
          </button>
        </div>
      )}
      <CometChatErrorBoundary
        componentName="HackMateMessages"
        onError={(errorContext) => {
          if (import.meta.env.DEV) {
            console.error('CometChat message surface failed.', {
              componentName: errorContext?.componentName,
              message: getSafeDeveloperMessage(errorContext?.error),
            });
          }
        }}
        fallbackView={(errorContext, retry) => (
          <div className="cc-error-fallback" role="alert">
            <div className="form-status-panel" data-tone="error">
              <span>Unable to connect to CometChat. Showing your existing Supabase messages instead.</span>
              {import.meta.env.DEV && (
                <details>
                  <summary>Developer error</summary>
                  <code>{getSafeDeveloperMessage(errorContext?.error)}</code>
                </details>
              )}
              <button type="button" className="text-button" onClick={retry}>
                Retry CometChat
              </button>
            </div>
            <SupabaseMessages
              session={session}
              selectedUserId={selectedUserId}
              onSelectUser={onSelectUser}
              onFindTeammates={onFindTeammates}
            />
          </div>
        )}
      >
        <div className="cc-app">
          {showContactList && (
            <aside className="cc-connections-column" aria-label="Connected teammates">
              <header className="cc-connections-header">
                <h3>Connections</h3>
                <span>{connectionsLoading ? '…' : contacts.length}</span>
              </header>
              <div className="cc-connections-list">
                {connectionsLoading ? (
                  <p className="cc-connections-empty" role="status">Loading connections…</p>
                ) : contacts.length ? (
                  contacts.map((contact) => (
                    <button
                      type="button"
                      className={`cc-connection-item ${selectedUserId === contact.id ? 'selected' : ''}`}
                      key={contact.id}
                      onClick={() => onSelectUser(contact.id)}
                      aria-current={selectedUserId === contact.id ? 'true' : undefined}
                    >
                      <span className="cc-connection-avatar" aria-hidden="true">
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt="" />
                        ) : (
                          contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
                        )}
                      </span>
                      <span>{contact.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="cc-connections-empty">
                    <p>No accepted connections yet.</p>
                    <button type="button" className="text-button" onClick={onFindTeammates}>
                      Find teammates
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}

          {showMessagePane && (
            <main className="cc-message-pane">
              {selectedCometChatUser ? (
                <>
                <CometChatMessageHeader
                  user={selectedCometChatUser}
                  hideBackButton={!isMobile}
                  onBack={() => onSelectUser(null)}
                  hideVoiceCallButton
                  hideVideoCallButton
                  showSearchOption
                  onSearchOptionClicked={() => setPanelSelection({
                    userId: activeContactId,
                    type: 'search',
                  })}
                  onError={handleComponentError}
                />
                <div className="cc-message-list-region">
                  <CometChatMessageList
                    key={selectedCometChatUser.getUid()}
                    user={selectedCometChatUser}
                    goToMessageId={goToMessageId}
                    hideReactionOption
                    onThreadRepliesClick={(message) => setPanelSelection({
                      userId: activeContactId,
                      type: 'thread',
                      message,
                    })}
                    onError={handleComponentError}
                  />
                </div>
                <CometChatMessageComposer
                  user={selectedCometChatUser}
                  hideAttachmentButton
                  hideAttachmentOptions={{
                    image: true,
                    video: true,
                    audio: true,
                    file: true,
                    polls: true,
                    collaborativeDocument: true,
                    collaborativeWhiteboard: true,
                  }}
                  disableDragAndDrop
                  hideVoiceRecordingButton
                  hideLiveReaction
                  onError={handleComponentError}
                />
                </>
              ) : (
                <div className="cc-message-empty">
                  {connectionsLoading ? (
                    <p role="status">Loading your connections…</p>
                  ) : selectedUserId && !activeContact ? (
                    <p>This teammate is no longer an accepted connection. Only connected teammates can be messaged.</p>
                  ) : loadingUser ? (
                    <p role="status">Loading CometChat user…</p>
                  ) : userError ? (
                    <div className="cc-inline-error" role="alert">
                      <p>{userError}</p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setLoadAttempt((current) => current + 1)}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <p>Select an accepted connection to start a private conversation.</p>
                  )}
                </div>
              )}
            </main>
          )}

          {showSidePanel && (
            <aside className={`cc-side-panel ${sidePanel.type === 'thread' ? 'cc-thread-panel' : ''}`}>
              {sidePanel.type === 'thread' && (
                <>
                  <CometChatThreadHeader
                    parentMessage={sidePanel.message}
                    onClose={() => setPanelSelection(null)}
                  />
                  <div className="cc-message-list-region">
                    <CometChatMessageList
                      user={selectedCometChatUser}
                      parentMessageId={sidePanel.message.getId()}
                      hideReactionOption
                      onError={handleComponentError}
                    />
                  </div>
                  <CometChatMessageComposer
                    user={selectedCometChatUser}
                    parentMessageId={sidePanel.message.getId()}
                    hideAttachmentButton
                    hideAttachmentOptions={{
                      image: true,
                      video: true,
                      audio: true,
                      file: true,
                      polls: true,
                      collaborativeDocument: true,
                      collaborativeWhiteboard: true,
                    }}
                    disableDragAndDrop
                    hideVoiceRecordingButton
                    hideLiveReaction
                    onError={handleComponentError}
                  />
                </>
              )}
              {sidePanel.type === 'search' && (
                <div className="cc-search-region">
                  <CometChatSearch
                    uid={selectedCometChatUser.getUid()}
                    searchIn={['messages']}
                    onBack={() => setPanelSelection(null)}
                    onMessageClicked={(event) => {
                      setMessageSelection({
                        userId: activeContactId,
                        messageId: event.message.getId(),
                      });
                      setPanelSelection(null);
                    }}
                  />
                </div>
              )}
            </aside>
          )}
        </div>
      </CometChatErrorBoundary>
    </section>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const updateMobile = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateMobile);
    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, []);

  return isMobile;
}

function SupabaseMessages({ session, selectedUserId, onSelectUser, onFindTeammates }) {
  const {
    conversations,
    activeContact,
    activeMessages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    sendError,
    connectionError,
    loadConversationMessages,
    sendMessage,
    clearSendError,
    reloadConversations,
  } = useMessages(session, selectedUserId);

  useEffect(() => {
    if (activeContact?.id) {
      void loadConversationMessages(activeContact.id);
    }
  }, [activeContact?.id, loadConversationMessages]);

  if (loadingConversations) {
    return (
      <div className="page">
        <div className="empty-state-card messages-loading" role="status">Loading conversations...</div>
      </div>
    );
  }

  const retryLoad = () => {
    void reloadConversations();
    if (activeContact?.id) void loadConversationMessages(activeContact.id);
  };

  return (
    <div className="page messages-page">
      {error && (
        <div className="form-status-panel" data-tone="error">
          <span>{error}</span>
          <button type="button" className="text-button" onClick={retryLoad}>Retry</button>
        </div>
      )}
      {connectionError && (
        <div className="form-status-panel" data-tone="error">
          You can only message connected teammates.
        </div>
      )}
      <section className="messages-layout">
        <ConversationList
          conversations={conversations}
          selectedUserId={selectedUserId}
          onSelect={onSelectUser}
        />
        <ConversationView
          key={activeContact?.id || 'no-active-conversation'}
          contact={activeContact}
          messages={activeMessages}
          currentUserId={session?.user?.id}
          loadingMessages={loadingMessages}
          sending={sending}
          error={sendError}
          onSend={(content) => sendMessage(activeContact?.id, content)}
          onClearError={clearSendError}
        />
      </section>
      {!activeContact && conversations.length === 0 && (
        <div className="messages-discover-cta">
          <p>No conversations yet.</p>
          <button type="button" className="primary-button" onClick={onFindTeammates}>
            Find Teammates →
          </button>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
