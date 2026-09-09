import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API key and verify
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fail.");
}

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: apiKey || "dummy-key",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API documentation or health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Endpoints
  app.post("/api/ai/generate-survey", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Generate a professional HR research survey based on this prompt: "${prompt}". 
        The survey should have a clear title and a list of structured questions.
        Questions can be of types: 'multiple_choice', 'checkbox', 'short_text', 'long_text', 'rating', 'nps', 'dropdown', 'matrix'.
        For 'multiple_choice', 'checkbox', and 'dropdown', provide relevant choices.
        For 'matrix', provide 'choices' (columns) and 'rows'.
        Each question needs a short 'alias' (1-2 words for data headers).`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    text: { type: Type.STRING },
                    desc: { type: Type.STRING },
                    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rows: { type: Type.ARRAY, items: { type: Type.STRING } },
                    required: { type: Type.BOOLEAN },
                    alias: { type: Type.STRING },
                  },
                  required: ['type', 'text', 'desc', 'required', 'alias'],
                },
              },
            },
            required: ['title', 'questions'],
          },
        },
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate survey" });
    }
  });

  app.post("/api/ai/test-responses", async (req, res) => {
    try {
      const { questions, count } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Generate ${count} test responses for the following survey questions. 
        Return an array of objects. Use exact question 'id' as key.`,
        config: { responseMimeType: "application/json" },
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate test responses" });
    }
  });

  app.post("/api/ai/suggest-answer", async (req, res) => {
    try {
      const { surveyTitle, questions, previousAnswers, currentQuestionId } = req.body;
      const currentQuestion = questions.find((q: any) => q.id === currentQuestionId);
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Act as a person taking this survey: "${surveyTitle}".
        
        Previous questions and your answers:
        ${JSON.stringify(Object.entries(previousAnswers).map(([qid, ans]) => {
          const q = questions.find((q: any) => q.id === qid);
          return { question: q?.text, answer: ans };
        }))}

        Current question to answer:
        Question: ${currentQuestion.text}
        Type: ${currentQuestion.type}
        ${currentQuestion.choices ? `Choices: ${currentQuestion.choices.join(', ')}` : ''}

        Provide a realistic answer for this question based on your simulated persona. 
        If it's multiple choice, pick one of the choices exactly.
        Return ONLY the answer as a JSON object with key "answer".`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING }
            },
            required: ["answer"]
          }
        },
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to suggest answer" });
    }
  });

  app.post("/api/ai/diagnose-survey", async (req, res) => {
    try {
      const { title, description, questions } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Act as an expert UX Researcher and Survey Designer. 
        Perform a diagnostic test on the following survey: "${title}".
        Description: "${description || 'No description provided'}"
        
        Identify potential issues (e.g., leading questions, ambiguity, survey fatigue, layout problems) and suggest specific improvements.
        
        Survey Structure:
        ${JSON.stringify(questions.map((q: any) => ({
          type: q.type,
          text: q.text,
          choices: q.choices,
          rows: q.rows,
          required: q.required,
          alias: q.alias,
          logic: q.logic
        })))}
        
        Provide a deep analysis. Look for:
        1. Cognitive Load: Are questions too complex or wordy?
        2. Sensitivity & Bias: Are there leading questions or sensitive topics handled poorly?
        3. Logic Integrity: Does the skip logic make sense or could it lead to dead ends?
        4. Consistency: Are scales (e.g., 1-5 vs 1-10) used consistently?
        5. Mobile Friendliness: Are matrix or long-choice questions suitable for small screens?
        
        Provide your findings in a structured JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.NUMBER, description: "Score from 0-100" },
              estimatedTime: { type: Type.STRING, description: "Estimated minutes" },
              fatigueLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, enum: ["Informational", "Minor", "Major", "Critical"] },
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    suggestion: { type: Type.STRING }
                  },
                  required: ["severity", "category", "title", "description", "suggestion"]
                }
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["overallScore", "estimatedTime", "fatigueLevel", "issues", "strengths"]
          }
        },
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to diagnose survey" });
    }
  });

  // Let Vite handle assets and SPA routing in dev
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }

  // Catch-all route to serve index.html for SPA routing
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl;
    
    // Skip if it looks like an API call
    if (url.startsWith('/api')) {
      return next();
    }

    try {
      if (process.env.NODE_ENV !== "production") {
        // In development, we read the host-root index.html and transform it
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } else {
        // In production, serve the built index.html from dist
        return res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      }
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
