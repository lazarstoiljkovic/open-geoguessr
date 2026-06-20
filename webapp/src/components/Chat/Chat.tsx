import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../../types';
import './Chat.scss';

interface Props {
  messages: ChatMessage[];
  teamMessages?: ChatMessage[];
  currentUserId?: string;
  teamsEnabled?: boolean;
  onSend: (text: string) => void;
  onSendTeam?: (text: string) => void;
}

export default function Chat({ messages, teamMessages = [], currentUserId, teamsEnabled, onSend, onSendTeam }: Props) {
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'global' | 'team'>('global');
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeMessages = tab === 'team' ? teamMessages : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (tab === 'team') onSendTeam?.(trimmed);
    else onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat">
      {teamsEnabled && (
        <div className="chat__tabs">
          <button
            className={`chat__tab${tab === 'global' ? ' chat__tab--active' : ''}`}
            onClick={() => setTab('global')}
          >
            Global
          </button>
          <button
            className={`chat__tab${tab === 'team' ? ' chat__tab--active' : ''}`}
            onClick={() => setTab('team')}
          >
            Team
            {teamMessages.length > 0 && tab === 'global' && (
              <span className="chat__tab-badge" />
            )}
          </button>
        </div>
      )}

      <div className="chat__messages">
        {activeMessages.length === 0 && (
          <p className="chat__empty">
            {tab === 'team' ? 'No team messages yet...' : 'No messages yet...'}
          </p>
        )}
        {activeMessages.map((msg, i) => {
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
          placeholder={tab === 'team' ? 'Message your team...' : 'Send a message...'}
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
