export type QuestionType = 'mcq' | 'short' | 'long';

export interface Option {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  body?: string;
  options?: Option[];
  referenceAnswer?: string;
  sourceFile: string;
  explicitTag?: QuestionType;
}

export interface QuizMetadata {
  title?: string;
  description?: string;
  author?: string;
  tags?: string[];
  timeLimit?: number;
}

export interface QuizFile {
  id: string;
  filename: string;
  metadata: QuizMetadata;
  questions: Question[];
  rawMarkdown: string;
  uploadedAt: number;
}

export interface UserAnswer {
  questionId: string;
  selectedOptions?: number[];
  textAnswer?: string;
  isCorrect?: boolean;
  aiScore?: number;
  aiFeedback?: string;
  keyMissing?: string[];
  answeredAt: number;
}

export interface TestConfig {
  quizFileIds: string[];
  mode: 'shuffle_all' | 'group_by_file';
  includeTypes?: QuestionType[];
  questionCount?: number;
  timeLimit?: number;
}

export interface TestSession {
  id: string;
  config: TestConfig;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  startedAt: number;
  finishedAt?: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface AiGradeResult {
  score: number;
  feedback: string;
  keyMissing: string[];
}

export interface AppSettings {
  geminiApiKey?: string;
  openrouterApiKey?: string;
  useDemoMode: boolean;
}
