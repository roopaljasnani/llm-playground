import type { ChatMessage } from '../types/chat';

export function ConversationThread({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ol className="thread">
      {messages.map((message, index) => (
        <li
          key={`${message.role}-${index}`}
          className={`thread__item thread__item--${message.role}`}
        >
          <span className="thread__role">
            {message.role === 'user' ? 'You' : 'Model'}
          </span>
          <pre>
            <code>{message.content}</code>
          </pre>
        </li>
      ))}
    </ol>
  );
}
