export interface GeneratedQuestion {
  type: 'multiple_choice' | 'checkbox' | 'short_text' | 'long_text' | 'rating' | 'nps' | 'dropdown' | 'matrix';
  text: string;
  desc: string;
  choices?: string[];
  rows?: string[];
  required: boolean;
  alias: string;
}

export interface GeneratedSurvey {
  title: string;
  questions: GeneratedQuestion[];
}

export interface SurveyDiagnostic {
  overallScore: number;
  estimatedTime: string;
  fatigueLevel: 'Low' | 'Medium' | 'High';
  issues: {
    severity: 'Informational' | 'Minor' | 'Major' | 'Critical';
    category: string;
    title: string;
    description: string;
    suggestion: string;
  }[];
  strengths: string[];
}

export async function generateSurvey(prompt: string): Promise<GeneratedSurvey> {
  const response = await fetch("/api/ai/generate-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate survey");
  }
  
  return response.json();
}

export async function generateTestResponses(questions: any[], count: number): Promise<any[]> {
  const response = await fetch("/api/ai/test-responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions, count }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate test responses");
  }
  
  return response.json();
}

export async function modifyQuestion(question: any, prompt: string): Promise<GeneratedQuestion> {
  // We can add a server endpoint for this too if needed, for now using generate logic
  const response = await fetch("/api/ai/generate-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `Modify this question: ${JSON.stringify(question)}. Prompt: ${prompt}` }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to modify question");
  }
  
  const data = await response.json();
  return data.questions[0];
}

export async function diagnoseSurvey(title: string, description: string, questions: any[]): Promise<SurveyDiagnostic> {
  const response = await fetch("/api/ai/diagnose-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, questions }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to diagnose survey");
  }
  
  return response.json();
}

export async function suggestNextAnswer(
  surveyTitle: string, 
  questions: any[], 
  previousAnswers: Record<string, any>, 
  currentQuestionId: string
): Promise<string> {
  const response = await fetch("/api/ai/suggest-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surveyTitle, questions, previousAnswers, currentQuestionId }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to suggest answer");
  }
  
  const data = await response.json();
  return data.answer;
}
