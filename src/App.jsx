import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL?.trim() || "";
const MAX_QUESTION_LENGTH = 1200;

const initialMessages = [
  {
    role: "assistant",
    content:
      "Hello, I am GaBayan AI. I can help you prepare questions before consulting a public attorney and provide general legal information only.",
  },
];

function formatRetryTime(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return "";

  const totalSeconds = Number(seconds);

  if (totalSeconds < 60) {
    return "in less than a minute";
  }

  const minutes = Math.ceil(totalSeconds / 60);

  if (minutes < 60) {
    return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);

  if (hours < 24) {
    return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return "tomorrow";
}

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);

  const messagesRef = useRef(null);
  const textareaRef = useRef(null);

  const quickQuestions = [
    {
      label: "Employment",
      question:
        "My employer has not paid my salary. What should I ask a public attorney and what documents should I prepare?",
    },
    {
      label: "Rental Concern",
      question:
        "Before signing a rental agreement, what questions should I ask and what should I check?",
    },
    {
      label: "Land or Property",
      question:
        "I have a concern about land or property. What should I prepare before talking to a public attorney?",
    },
    {
      label: "Family Matter",
      question:
        "For a family-related legal concern, what should I ask a public attorney?",
    },
  ];

  const safetyTopics = [
    "Court hearings",
    "Criminal cases",
    "Land disputes",
    "Contract signing",
    "Urgent deadlines",
    "Threats or violence",
  ];

  useEffect(() => {
    if (!messagesRef.current) return;

    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const addMessage = (role, content) => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
      },
    ]);
  };

  const handleAsk = async (e) => {
    e.preventDefault();

    const userQuestion = question.trim();

    if (!userQuestion || loading) return;

    if (userQuestion.length > MAX_QUESTION_LENGTH) {
      addMessage(
        "assistant",
        `Your question is too long. Please keep it under ${MAX_QUESTION_LENGTH} characters.`
      );
      return;
    }

    addMessage("user", userQuestion);

    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userQuestion,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 429) {
        const retryText = formatRetryTime(data.retryAfterSeconds);

        throw new Error(
          `${data.error || "Daily chat limit reached."}${
            retryText ? ` Please try again ${retryText}.` : ""
          }`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Request failed. Please try again.");
      }

      addMessage(
        "assistant",
        data.reply || "Sorry, I could not generate a response."
      );
    } catch (error) {
      addMessage(
        "assistant",
        error.message ||
          "Sorry, GaBayan AI could not connect to the server. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (text) => {
    setQuestion(text);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleClearChat = () => {
    setMessages(initialMessages);
    setQuestion("");

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk(e);
    }
  };

  const remainingText =
    "Daily usage is limited to help protect the free AI quota.";

  return (
    <div className="app">
      <header className="site-header">
        <nav className="nav">
          <a href="/" className="brand" aria-label="GaBayan AI Home">
            <img
              src="/GaBayan-logo.png"
              alt="GaBayan AI Logo"
              className="brand-logo"
            />

            <span className="brand-text">GaBayan AI</span>
          </a>

          <div className="nav-actions">
            <a href="#chat" className="nav-link">
              Ask AI
            </a>
            <a href="#disclaimer" className="nav-link">
              Disclaimer
            </a>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Legal Guidance Assistant</p>

            <h1>Prepare better questions before consulting a public attorney.</h1>

            <p className="hero-description">
              GaBayan AI helps users understand general legal concerns, prepare
              useful questions, and organize important details before speaking
              with a public attorney or licensed lawyer.
            </p>

            <div className="hero-actions">
              <a href="#chat" className="primary-button">
                Start Asking
              </a>

              <a href="#disclaimer" className="secondary-button">
                Read Disclaimer
              </a>
            </div>
          </div>

          <aside className="hero-panel" aria-label="Legal disclaimer summary">
            <p className="panel-label">Important</p>
            <h2>General information only.</h2>
            <p>
              This app does not replace a lawyer, public attorney, or official
              legal consultation.
            </p>
          </aside>
        </section>
      </header>

      <main>
        <section className="chat-shell" id="chat">
          <section className="chat-card" aria-label="GaBayan AI Chat">
            <div className="chat-header">
              <div>
                <p className="eyebrow">AI Chat</p>
                <h2>Ask your legal concern</h2>
              </div>

              <button
                type="button"
                className="clear-button"
                onClick={handleClearChat}
                disabled={loading}
              >
                Clear
              </button>
            </div>

            <div className="privacy-note">
              Do not enter sensitive personal information such as full addresses,
              passwords, ID numbers, or private case details.
            </div>

            <div className="privacy-note" role="status">
              {remainingText}
            </div>

            <div className="messages" ref={messagesRef}>
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`message-row ${
                    message.role === "user" ? "from-user" : "from-ai"
                  }`}
                >
                  <div className="avatar">
                    {message.role === "user" ? "You" : "AI"}
                  </div>

                  <div className="message-bubble">
                    {message.content.split("\n").map((line, lineIndex) => (
                      <p key={lineIndex}>{line || "\u00A0"}</p>
                    ))}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row from-ai">
                  <div className="avatar">AI</div>

                  <div className="message-bubble typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            <form className="chat-form" onSubmit={handleAsk}>
              <label htmlFor="question" className="input-label">
                Describe your concern
              </label>

              <textarea
                ref={textareaRef}
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Example: "My employer has not paid my salary for 2 months. What should I ask a public attorney and what documents should I prepare?"'
                maxLength={MAX_QUESTION_LENGTH}
                disabled={loading}
              />

              <div className="form-footer">
                <span>
                  {question.length}/{MAX_QUESTION_LENGTH}
                </span>

                <button type="submit" disabled={loading || !question.trim()}>
                  {loading ? "Checking..." : "Ask GaBayan AI"}
                </button>
              </div>
            </form>
          </section>

          <aside className="sidebar">
            <div className="sidebar-card">
              <p className="eyebrow">Quick Start</p>
              <h2>Common concerns</h2>
              <p>
                Choose a topic to fill the chat box, then edit it based on your
                situation.
              </p>

              <div className="quick-list">
                {quickQuestions.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    className="quick-button"
                    onClick={() => handleQuickQuestion(item.question)}
                    disabled={loading}
                  >
                    <span>{item.label}</span>
                    <small>Prepare questions</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-card safety-card">
              <p className="eyebrow">Seek professional help for</p>

              <div className="safety-tags">
                {safetyTopics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="help-section" id="how-it-helps">
          <div className="section-heading">
            <p className="eyebrow">How it helps</p>
            <h2>Built for preparation, not replacement.</h2>
          </div>

          <div className="help-grid">
            <article className="help-card">
              <span className="card-number">01</span>
              <h3>Understand your concern</h3>
              <p>
                Get a simple explanation of general legal concepts without
                confusing legal jargon.
              </p>
            </article>

            <article className="help-card">
              <span className="card-number">02</span>
              <h3>Prepare better questions</h3>
              <p>
                Know what to ask before going to a public attorney, lawyer, or
                legal office.
              </p>
            </article>

            <article className="help-card">
              <span className="card-number">03</span>
              <h3>Organize documents</h3>
              <p>
                Prepare facts, dates, documents, and other details that may be
                useful during consultation.
              </p>
            </article>
          </div>
        </section>

        <section className="disclaimer" id="disclaimer">
          <div>
            <p className="eyebrow">Disclaimer</p>
            <h2>This is not legal advice.</h2>
          </div>

          <p>
            GaBayan AI provides general legal information only. It is not a
            lawyer, not a public attorney, and does not replace advice from a
            licensed legal professional. For urgent matters, court hearings,
            criminal cases, active disputes, deadlines, threats, or document
            signing concerns, consult a licensed lawyer or public attorney.
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} GaBayan AI. General legal information
          only.
        </p>
      </footer>
    </div>
  );
}

export default App;