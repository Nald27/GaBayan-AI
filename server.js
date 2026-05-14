import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/*
  IMPORTANT:
  If your backend is deployed on Render, Railway, Fly.io, etc.,
  Express is usually behind a proxy.

  This helps express-rate-limit detect the real visitor IP better.
*/
app.set("trust proxy", 1);

app.disable("x-powered-by");

const CHAT_DAILY_LIMIT = parsePositiveInt(process.env.CHAT_DAILY_LIMIT, 5);
const CHAT_MAX_LENGTH = parsePositiveInt(process.env.CHAT_MAX_LENGTH, 1200);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(",") : []),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRetryAfterSeconds(req, fallbackSeconds) {
  const resetTime = req.rateLimit?.resetTime;

  if (resetTime) {
    const resetDate = new Date(resetTime);
    const seconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
    return Math.max(seconds, 1);
  }

  return fallbackSeconds;
}

function createRateLimitHandler(message, fallbackSeconds) {
  return (req, res) => {
    const retryAfterSeconds = getRetryAfterSeconds(req, fallbackSeconds);

    return res.status(429).json({
      error: message,
      code: "RATE_LIMITED",
      limit: req.rateLimit?.limit ?? null,
      remaining: req.rateLimit?.remaining ?? 0,
      retryAfterSeconds,
      resetTime: req.rateLimit?.resetTime ?? null,
    });
  };
}

app.use(
  cors({
    origin: (origin, callback) => {
      /*
        Allow requests with no origin, such as:
        - Postman
        - server-to-server requests
        - some health checks
      */
      if (!origin) {
        return callback(null, true);
      }

      if (uniqueAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "30kb" }));

/*
  This protects your API from repeated fast clicking/spam.
  Example: max 10 chat attempts every 1 minute per IP.
*/
const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "chat-burst-limit",
  handler: createRateLimitHandler(
    "Too many messages sent too quickly. Please wait a moment before trying again.",
    60
  ),
});

/*
  This protects your Gemini free tier.
  The daily limit is controlled by CHAT_DAILY_LIMIT in your .env or Render environment variables.
*/

const chatDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: CHAT_DAILY_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "chat-daily-limit",
  handler: createRateLimitHandler(
    "Daily chat limit reached. Please try again later.",
    24 * 60 * 60
  ),
});

function validateChatMessage(req, res, next) {
  const { message } = req.body || {};

  if (typeof message !== "string") {
    return res.status(400).json({
      error: "Please enter a valid question.",
    });
  }

  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return res.status(400).json({
      error: "Please enter a question first.",
    });
  }

  if (cleanMessage.length > CHAT_MAX_LENGTH) {
    return res.status(400).json({
      error: `Your question is too long. Please keep it under ${CHAT_MAX_LENGTH} characters.`,
    });
  }

  req.cleanMessage = cleanMessage;
  next();
}

function requireGeminiApiKey(req, res, next) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY in server environment.",
    });
  }

  next();
}

const systemPrompt = `
You are GaBayan AI, a legal information and public attorney preparation assistant for users in the Philippines.

Your role:
- Help users understand general legal concepts.
- Help users prepare better questions before consulting a public attorney or licensed lawyer.
- Help users organize facts, documents, and concerns.
- Redirect users to a professional when their issue requires legal judgment.

Very important rules:
- You are not a lawyer.
- You are not a public attorney.
- You do not provide official legal advice.
- You do not represent the user.
- You do not guarantee legal outcomes.
- You do not tell the user exactly what legal action to take.
- You may provide general legal information only.

Always redirect the user to a licensed lawyer, public attorney, or proper legal office when the question involves:
- Court hearings
- Criminal cases
- Arrest, warrant, subpoena, summon, or police matter
- Violence, threats, abuse, or immediate danger
- Land title disputes
- Inheritance disputes
- Contract disputes
- Employer disputes that need case evaluation
- Filing a case
- Active legal case
- Deadlines
- Signing legal documents
- Notarization concerns
- Any situation requiring legal strategy or legal judgment

Response style:
- Use simple English.
- Be warm, calm, and practical.
- Do not sound robotic.
- Avoid complex legal jargon.
- If the user writes in Filipino or Taglish, you may respond naturally in Taglish.
- Keep the answer organized.

Always use this format:

1. General Guidance
2. Questions to Ask a Public Attorney
3. Documents or Details to Prepare
4. When to Seek Professional Help

End with this reminder:
"This is general legal information only and not a substitute for advice from a licensed lawyer or public attorney."
`;

app.get("/", (req, res) => {
  res.send("GaBayan AI backend is running.");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "GaBayan AI",
    dailyChatLimit: CHAT_DAILY_LIMIT,
    model: GEMINI_MODEL,
  });
});

app.post(
  "/api/chat",
  validateChatMessage,
  requireGeminiApiKey,
  chatBurstLimiter,
  chatDailyLimiter,
  async (req, res) => {
    try {
      const userPrompt = `
User question:
"${req.cleanMessage}"

Answer according to the GaBayan AI rules.
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          temperature: 0.3,
          maxOutputTokens: 900,
        },
      });

      const reply =
        response.text?.trim() || "Sorry, I could not generate a response.";

      return res.json({
        reply,
      });
    } catch (error) {
      console.error("GaBayan AI server error:", error);

      return res.status(502).json({
        error:
          "GaBayan AI could not generate a response right now. Please try again later.",
      });
    }
  }
);

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "This frontend is not allowed to access the GaBayan AI backend.",
    });
  }

  console.error("Unexpected server error:", err);

  return res.status(500).json({
    error: "Something went wrong on the server.",
  });
});

app.listen(PORT, () => {
  console.log(`GaBayan AI server running on http://localhost:${PORT}`);
});