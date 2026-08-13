import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Default GAS Web App URL from prompt
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbyTP0hfXvAKpmC1USIytbGBO3Mrs1KK_36aeIaDi6Mo5R_nwGmo4Ln_XknsyEWjJxQz/exec";

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 2. Google Apps Script Proxy Handler (handles CORS & GAS 302 Redirects)
app.post("/api/gas/proxy", async (req, res) => {
  try {
    const { gasUrl, action, ...params } = req.body;
    const targetUrl = gasUrl || DEFAULT_GAS_URL;

    // For GET actions
    if (action === "getIdeasAndAnalysis") {
      const fetchUrl = `${targetUrl}?action=getIdeasAndAnalysis&t=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`GAS request failed with status ${response.status}`);
      }
      const data = await response.json();
      return res.json({ status: "SUCCESS", ...data });
    }

    // For POST actions (saveIdea, updateIdea, deleteIdea, incrementViewCount)
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });

    if (!response.ok) {
      throw new Error(`GAS POST request failed with status ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: "SUCCESS", raw: text };
    }

    return res.json(data);
  } catch (error: any) {
    console.error("GAS Proxy Error:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error?.message || "Failed to communicate with Google Apps Script",
    });
  }
});

// 3. Gemini AI: Auto-Tag & Title Suggestion
app.post("/api/gemini/auto-tag", async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title && !content) {
      return res.status(400).json({ error: "Title or content is required" });
    }

    const ai = getGeminiClient();
    const prompt = `Analyze this idea/note and generate classification tags, a polished concise title, a 1-sentence summary, and 1 key takeaway in Korean.

Idea Title: "${title || "제목 없음"}"
Idea Content: "${content || "내용 없음"}"

Return JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING, description: "A polished, clear title" },
            suggestedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 5 relevant Korean tag names without #"
            },
            summary: { type: Type.STRING, description: "1-sentence concise summary in Korean" },
            keyTakeaway: { type: Type.STRING, description: "Key actionable insight or concept" }
          },
          required: ["suggestedTags"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Auto-Tag Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to analyze idea" });
  }
});

// 4. Gemini AI: Creative Synthesis (Lateral Thinking)
app.post("/api/gemini/synthesize", async (req, res) => {
  try {
    const { ideas } = req.body; // Array of ideas
    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({ error: "At least one idea is required for synthesis" });
    }

    const ai = getGeminiClient();
    const ideasPrompt = ideas.map((item: any, idx: number) => `
Idea #${idx + 1}:
- Title: ${item.title}
- Tags: ${(item.tags || []).join(", ")}
- Content: ${item.content}
`).join("\n");

    const prompt = `You are an expert lateral thinking AI consultant. Analyze these ideas from the user's knowledge vault and discover a novel, creative cross-disciplinary connection or project proposal that combines them:

${ideasPrompt}

Generate a compelling synthesis in Korean with:
1. A bold new project/idea title (synthesisTitle)
2. Detailed explanation of how these concepts merge (conceptDescription)
3. 3 concrete actionable next steps (actionableNextSteps)

Return valid JSON according to schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            synthesisTitle: { type: Type.STRING },
            conceptDescription: { type: Type.STRING },
            actionableNextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["synthesisTitle", "conceptDescription", "actionableNextSteps"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json({
      ...result,
      combinedIdeas: ideas.map((i: any) => ({ id: i.id, title: i.title }))
    });
  } catch (error: any) {
    console.error("Gemini Synthesize Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to synthesize ideas" });
  }
});

// 5. Gemini AI: Q&A Chat over Knowledge Base
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { question, ideas } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const ai = getGeminiClient();
    const vaultContext = (ideas || [])
      .map((item: any) => `[ID: ${item.id}] 제목: ${item.title} | 태그: ${(item.tags || []).join(", ")} | 내용: ${item.content}`)
      .join("\n");

    const prompt = `You are IdeaHub AI, a smart knowledge vault assistant.
Answer the user's question accurately in polite Korean, referencing specific notes in the vault when relevant.

User Question: "${question}"

Knowledge Vault Notes (${(ideas || []).length} items):
${vaultContext || "No notes saved yet."}

Provide a helpful, well-structured response in Markdown. Also identify which note IDs (e.g. "ID_1719361200000") were referenced in your answer.

Return JSON according to schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING, description: "Detailed Markdown response in Korean" },
            referencedIdeaIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of note IDs referenced"
            }
          },
          required: ["answer"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to generate chat response" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IdeaHub Server running on http://localhost:${PORT}`);
  });
}

startServer();
