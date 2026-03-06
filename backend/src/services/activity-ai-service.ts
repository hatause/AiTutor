import { ActivityType } from '@prisma/client';
import { env } from '../config/env.js';

export type ActivityTranscriptMessage = {
  role: 'student' | 'ai';
  text: string;
};

const DEBATE_ROLES = ['Скептик', 'Клиент', 'Профессор'];

const trimTranscript = (transcript: ActivityTranscriptMessage[]): ActivityTranscriptMessage[] =>
  transcript
    .map((item) => ({
      role: item.role,
      text: item.text.trim()
    }))
    .filter((item) => item.text.length > 0)
    .slice(-16);

const getLastStudentMessage = (transcript: ActivityTranscriptMessage[]): string => {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i].role === 'student') {
      return transcript[i].text;
    }
  }
  return '';
};

const getDebateRole = (turnNo: number): string => DEBATE_ROLES[(turnNo - 1) % DEBATE_ROLES.length];

const extractModelText = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const raw = payload as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = raw.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim())
    .find((part): part is string => Boolean(part && part.length > 0));
  return text ?? null;
};

const callGeminiText = async (prompt: string): Promise<string | null> => {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const models = [env.GEMINI_MODEL, 'gemini-2.5-flash-lite']
    .filter((model, index, array) => model && array.indexOf(model) === index);

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5
    }
  };

  for (const model of models) {
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          continue;
        }
        const parsed = (await res.json()) as unknown;
        const text = extractModelText(parsed);
        if (text && text.length > 0) {
          return text;
        }
      } catch {
        // fallback below
      }
    }
  }

  return null;
};

const fallbackReply = (params: {
  type: ActivityType;
  subjectName: string;
  turnNo: number;
  lastStudentMessage: string;
  roleLabel?: string;
}): string => {
  const { type, subjectName, turnNo, lastStudentMessage, roleLabel } = params;

  if (type === ActivityType.FEYNMAN) {
    if (turnNo === 1) {
      return `Я новичок и путаюсь. Объясни тему "${subjectName}" очень простыми словами: что это и зачем это нужно?`;
    }
    const shortRef = lastStudentMessage.slice(0, 90);
    return `Проверяю себя: я понял так -> "${shortRef}". Возможно, это неверно. Исправь меня и приведи один короткий пример.`;
  }

  if (turnNo === 1) {
    const role = roleLabel ?? getDebateRole(turnNo);
    return `[${role}] Тезис по предмету "${subjectName}": сформулируй позицию и дай 2 аргумента в её защиту.`;
  }

  const role = roleLabel ?? getDebateRole(turnNo);
  const shortRef = lastStudentMessage.slice(0, 120);
  return `[${role}] Контраргумент к твоей позиции: "${shortRef}". Ответь на возражение и усили аргументацию практическим примером.`;
};

export const generateActivityReply = async (params: {
  type: ActivityType;
  subjectName: string;
  transcript: ActivityTranscriptMessage[];
  language?: string;
}): Promise<{ aiText: string; roleLabel?: string }> => {
  const transcript = trimTranscript(params.transcript);
  const turnNo = transcript.filter((item) => item.role === 'ai').length + 1;
  const roleLabel = params.type === ActivityType.DEBATE ? getDebateRole(turnNo) : undefined;
  const lastStudentMessage = getLastStudentMessage(transcript);
  const language = params.language?.toLowerCase().startsWith('en') ? 'English' : 'Русский';

  const prompt = JSON.stringify({
    task: params.type === ActivityType.FEYNMAN ? 'Feynman tutoring turn' : 'Debate challenge turn',
    language,
    subject: params.subjectName,
    role: roleLabel ?? 'Любопытный собеседник',
    turnNo,
    instructions:
      params.type === ActivityType.FEYNMAN
        ? [
            'Ты задаешь один уточняющий вопрос как новичок.',
            'Иногда допусти небольшую логическую ошибку и попроси исправить.',
            'Ответ только обычным текстом, без JSON и markdown.',
            'До 450 символов.'
          ]
        : [
            'Ты ведешь дебаты и выступаешь как указанная роль.',
            'Дай один контраргумент и один вопрос.',
            'Тон строгий, но учебный.',
            'Ответ только обычным текстом, без JSON и markdown.',
            'До 500 символов.'
          ],
    transcript
  });

  const aiTextRaw = await callGeminiText(prompt);
  const aiText = (aiTextRaw ?? '').replace(/\s+/g, ' ').trim();

  if (aiText.length > 0) {
    return {
      aiText,
      roleLabel
    };
  }

  return {
    aiText: fallbackReply({
      type: params.type,
      subjectName: params.subjectName,
      turnNo,
      lastStudentMessage,
      roleLabel
    }),
    roleLabel
  };
};
