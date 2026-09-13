import type { ChatMessage } from '../types/chat';

function roleLabel(message: ChatMessage): string {
  if (message.kind === 'summary') {
    return 'Summary';
  }
  return message.role === 'user' ? 'You' : 'Model';
}

export function ConversationThread({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ol className="thread">
      {messages.map((message, index) => (
        <li
          key={`${message.role}-${index}`}
          className={`thread__item thread__item--${message.kind ?? message.role}`}
        >
          <span className="thread__role">{roleLabel(message)}</span>
          <pre>
            <code>{message.content}</code>
          </pre>
        </li>
      ))}
    </ol>
  );
}
