import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Enable CORS for iframe environments
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

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

/**
 * Executes Gemini generateContent with automatic model fallback
 * Handles transient 503 (high demand) and 429 rate limit spikes automatically
 */
async function callGeminiWithFallback(ai: GoogleGenAI, options: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const modelChain = [
    options.preferredModel || "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest"
  ];

  let lastError: any = null;
  for (const model of modelChain) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini API] Model ${model} encountered an issue:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
}

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

    const response = await callGeminiWithFallback(ai, {
      preferredModel: "gemini-3.1-flash-lite",
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

    const response = await callGeminiWithFallback(ai, {
      preferredModel: "gemini-3.1-flash-lite",
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

    const response = await callGeminiWithFallback(ai, {
      preferredModel: "gemini-3.1-flash-lite",
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
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "질문 내용을 입력해주세요." });
    }

    const ai = getGeminiClient();
    const cleanQuestion = String(question).trim();
    const userTerms = cleanQuestion.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);

    // Score and rank notes by relevance to the question
    const scoredIdeas = (ideas || []).map((item: any) => {
      let score = 0;
      const t = (item.title || "").toLowerCase();
      const c = (item.content || "").toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();

      for (const term of userTerms) {
        if (t.includes(term)) score += 5;
        if (tags.includes(term)) score += 3;
        if (c.includes(term)) score += 1;
      }
      return { item, score };
    });

    scoredIdeas.sort((a: any, b: any) => b.score - a.score);

    // Prioritize top 30 most relevant notes with full content, and next 50 with title & tags
    const relevantFull = scoredIdeas.slice(0, 30).map((s: any) => s.item);
    const relevantBrief = scoredIdeas.slice(30, 70).map((s: any) => s.item);

    const vaultContext = [
      ...relevantFull.map((item: any) => `[ID: ${item.id}] 제목: ${item.title} | 태그: ${(item.tags || []).join(", ")} | 본문: ${item.content}`),
      ...relevantBrief.map((item: any) => `[ID: ${item.id}] 제목: ${item.title} | 태그: ${(item.tags || []).join(", ")}`)
    ].join("\n\n");

    const prompt = `당신은 IdeaHub 지식창고의 전담 AI 비서입니다.
사용자의 질문에 대해 저장된 지식 노트를 철저히 분석하여 공손하고 유익한 한국어로 답변해 주세요.

[사용자 질문]:
"${cleanQuestion}"

[사용자의 지식창고 보관 노트 (${(ideas || []).length}개 중 추출)]:
${vaultContext || "보관된 지식 노트가 없습니다."}

[답변 작성 가이드]:
1. 지식창고에 저장된 구체적 내용과 제목을 적극 인용하여 상세하고 신뢰성 있게 설명할 것.
2. 마크다운 형식(소제목, 글머리 기호, 볼드체 등)을 활용하여 가독성 높게 구성할 것.
3. 답변을 도출하는 데 직접적으로 참고한 노트들의 ID(예: "ID-1781960264270")를 referencedIdeaIds 배열에 담아 전달할 것.

Return JSON according to the schema.`;

    const response = await callGeminiWithFallback(ai, {
      preferredModel: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING, description: "상세하고 체계적인 한국어 마크다운 답변" },
            referencedIdeaIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "참고한 지식 노트의 고유 ID 목록"
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
    return res.status(500).json({ error: error?.message || "AI 지식 비서 응답 생성에 실패했습니다." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback: serve transformed index.html for all unhandled GET requests
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api/")) return next();
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
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
