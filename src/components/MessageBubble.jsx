function MessageBubble({ message, isOwn }) {
  const date = new Date(message.createdAt);
  const timestamp = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <article className={`message-row ${isOwn ? 'own-message' : 'received-message'}`}>
      <div className="message-bubble">
        <p>{message.content}</p>
        <time dateTime={message.createdAt}>{timestamp}</time>
      </div>
    </article>
  );
}

export default MessageBubble;
