"use client";

import { useState, useRef, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  objectName: string | null;
  onUpload?: (files: FileList) => void;
};

const QUICK_PROMPTS = [
  "What tables are affected?",
  "Show rollback plan",
  "Explain risk score",
  "What tests to run?",
];

// Paperclip SVG icon
const PaperclipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

// Send arrow SVG icon
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

export default function ChatPanel({ objectName, onUpload }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), object_name: objectName, history: messages }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, couldn't process that. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      if (onUpload) onUpload(e.target.files);
      const names = Array.from(e.target.files).map(f => f.name).join(", ");
      setMessages((prev) => [...prev, { role: "user", content: `Uploaded: ${names}` }]);
      e.target.value = "";
    }
  }

  return (
    <div className="chat-inline">
      <div className="chat-inline-header">
        <span className="chat-inline-title">Ask Ora1</span>
        {objectName && <span className="chat-inline-ctx">{objectName}</span>}
      </div>

      <div className="chat-inline-messages">
        {messages.length === 0 && (
          <div className="chat-inline-empty">
            <p>Ask about dependencies, impact, fixes, or rollback plans.</p>
            <div className="chat-inline-prompts">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} className="chat-pill" onClick={() => sendMessage(p)}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg--${msg.role}`}>{msg.content}</div>
        ))}

        {loading && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-loading"><span /><span /><span /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && !loading && (
        <div className="chat-inline-prompts-bar">
          {QUICK_PROMPTS.slice(0, 3).map((p) => (
            <button key={p} className="chat-pill chat-pill--sm" onClick={() => sendMessage(p)}>{p}</button>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <button className="chat-attach" onClick={() => fileRef.current?.click()} title="Attach Oracle artifacts">
          <PaperclipIcon />
        </button>
        <input
          ref={inputRef}
          className="chat-text-input"
          placeholder="Ask about impact, dependencies, fixes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button className="chat-send" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <SendIcon />
        </button>
        <input ref={fileRef} type="file" multiple accept=".sql,.xml,.groovy,.pls,.pkb,.pks" style={{ display: "none" }} onChange={handleFileSelect} />
      </div>
    </div>
  );
}
