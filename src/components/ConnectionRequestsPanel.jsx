function ConnectionRequestsPanel({
  requests,
  profilesByUserId,
  currentUserId,
  onRespond,
  busyRequestId,
}) {
  const incoming = requests.filter(
    (request) => request.receiverId === currentUserId && request.status === 'pending',
  );
  const outgoing = requests.filter(
    (request) => request.senderId === currentUserId && request.status === 'pending',
  );
  const connections = requests.filter((request) => request.status === 'accepted');

  const displayPerson = (userId) => profilesByUserId[userId] || { name: 'Private HackMate member' };

  return (
    <section className="connection-panel">
      <div className="section-header row-between">
        <div>
          <h3>Connections &amp; requests</h3>
          <p className="section-supporting-text">Manage connection requests between HackMate members.</p>
        </div>
      </div>

      <div className="connection-columns">
        <div className="connection-column">
          <h4>Incoming requests <span className="counter-pill">{incoming.length}</span></h4>
          {incoming.length ? incoming.map((request) => {
            const person = displayPerson(request.senderId);
            return (
              <article className="connection-request-row" key={request.id}>
                <div>
                  <strong>{person.name}</strong>
                  <p>{person.role || (person.username ? `@${person.username}` : 'Connection request')}</p>
                </div>
                <div className="connection-row-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busyRequestId === request.id}
                    onClick={() => onRespond(request.id, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="primary-button small"
                    disabled={busyRequestId === request.id}
                    onClick={() => onRespond(request.id, 'accepted')}
                  >
                    {busyRequestId === request.id ? 'Saving…' : 'Accept'}
                  </button>
                </div>
              </article>
            );
          }) : <p className="empty-copy">No incoming requests.</p>}
        </div>

        <div className="connection-column">
          <h4>Outgoing requests <span className="counter-pill">{outgoing.length}</span></h4>
          {outgoing.length ? outgoing.map((request) => {
            const person = displayPerson(request.receiverId);
            return (
              <article className="connection-request-row" key={request.id}>
                <div>
                  <strong>{person.name}</strong>
                  <p>{person.role || (person.username ? `@${person.username}` : 'Request pending')}</p>
                </div>
                <span className="connection-state-pill">Pending</span>
              </article>
            );
          }) : <p className="empty-copy">No outgoing requests.</p>}
        </div>

        <div className="connection-column">
          <h4>Connections <span className="counter-pill">{connections.length}</span></h4>
          {connections.length ? connections.map((request) => {
            const counterpartId = request.senderId === currentUserId ? request.receiverId : request.senderId;
            const person = displayPerson(counterpartId);
            return (
              <article className="connection-request-row" key={request.id}>
                <div>
                  <strong>{person.name}</strong>
                  <p>{person.role || (person.username ? `@${person.username}` : 'Connected')}</p>
                </div>
                <span className="connection-state-pill connected-state">Connected</span>
              </article>
            );
          }) : <p className="empty-copy">Your connections will appear here.</p>}
        </div>
      </div>
    </section>
  );
}

export default ConnectionRequestsPanel;
