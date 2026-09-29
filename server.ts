import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Default GAS Web App URL from prompt
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwxMyj2Ztb5qtIYGHgU2MipDl6hQOv-6xP18EPHdNkPfE0ndN6d6gaCcvTgNgApGqUw/exec";

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
      model: "gemini-3.8-flash",
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
      model: "gemini-3.8-flash",
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

// 4.5. Gemini AI: Smart Merge & Synthesis of Multiple Notes
app.post("/api/gemini/merge-notes", async (req, res) => {
  try {
    const { notes, bookTitle } = req.body;
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: "At least one note is required to merge" });
    }

    const ai = getGeminiClient();
    const notesContent = notes
      .map((n: any, idx: number) => `### [메모 ${idx + 1}] ${n.title}\n- 작성일: ${n.date || "미상"}\n- 본문:\n${n.content}`)
      .join("\n\n---\n\n");

    const prompt = `당신은 지식 아카이빙 및 도서 독서록 종합 전문가입니다.
사용자가 ${bookTitle ? `[${bookTitle}] 도서/출처에서` : ""} 작성한 여러 편의 분절된 발췌 및 메모들을 검토하여, 논리적 흐름이 매끄럽고 중복이 정돈된 **하나의 완성된 종합 독서 리포트/지식 노트(Markdown)**로 통합해 주세요.

[요구사항]
1. 원본의 핵심 통찰, 원문 발췌 내용, 저자 인용구를 왜곡하거나 임의로 삭제하지 말고 충실히 살릴 것.
2. 흩어진 조각들을 기승전결 또는 주제별 소제목(##, ###)과 순서 목록(1. 2. 3.)으로 체계적으로 묶어 읽기 편하게 구성할 것.
3. 한국어로 작성하며, 강조할 부분은 **볼드**나 마크다운 형식을 적절히 사용할 것.
4. 결과물로 제공할 종합 제목(mergedTitle)과 마크다운 본문(mergedContent), 그리고 1문장 핵심 요약(summary)을 생성할 것.

[통합할 원본 메모들 (${notes.length}개)]:
${notesContent}

Return JSON according to the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mergedTitle: { type: Type.STRING, description: "통합 노트 제목 (예: [통합본] 도서명 종합 발췌 및 독서록)" },
            mergedContent: { type: Type.STRING, description: "정리된 완성형 마크다운 본문" },
            summary: { type: Type.STRING, description: "통합본 1문장 핵심 요약" }
          },
          required: ["mergedTitle", "mergedContent", "summary"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Merge Notes Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to merge notes" });
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
      model: "gemini-3.8-flash",
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
