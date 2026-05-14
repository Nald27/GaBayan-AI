import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:4173",
        process.env.CLIENT_URL,
      ].filter(Boolean);

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        !process.env.CLIENT_URL
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

// Limit each IP to 5 chats every 24 hours
const chatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      "Daily chat limit reached. Please try again tomorrow.",
  },
});

app.get("/", (req, res) => {
  res.send("GaBayan AI backend is running.");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "GaBayan AI",
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a question first.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in server environment.",
      });
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

    const userPrompt = `
User question:
"${message}"

Answer according to the GaBayan AI rules.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\n${userPrompt}`,
    });

    res.json({
      reply: response.text || "Sorry, I could not generate a response.",
    });
  } catch (error) {
    console.error("GaBayan AI server error:", error);

    res.status(500).json({
      error: "Something went wrong while processing your question.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`GaBayan AI server running on http://localhost:${PORT}`);
});