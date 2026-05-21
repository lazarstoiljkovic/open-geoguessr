import React, { useEffect, useRef, useState } from 'react';
import './Chat.scss';

export interface ChatMessage {
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
  onSend: (text: string) => void;
}

export default function Chat({ messages, currentUserId, onSend }: Props) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <p className="chat__empty">No messages yet...</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === currentUserId;
          return (
            <div key={i} className={`chat__msg${isMe ? ' chat__msg--me' : ''}`}>
              {!isMe && <span className="chat__author">{msg.username}</span>}
              <span className="chat__bubble">{msg.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <input
          className="chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message..."
          maxLength={300}
          autoComplete="off"
        />
        <button className="chat__send" type="submit" disabled={!text.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
