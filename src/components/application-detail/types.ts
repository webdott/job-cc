export interface TimelineEvent {
  type: string;
  stage?: string;
  note?: string;
  at: string;
}

export interface Contact {
  name: string;
  role?: string;
  email?: string;
  linkedin?: string;
}

export interface CoverLetterData {
  id: string;
  content: string;
  tone: string;
  versions: { content: string; tone: string; at: string }[];
  updatedAt: string;
}

export interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  sourceUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  evaluation: JobEvaluation | null;
}

export interface Application {
  id: string;
  stage: string;
  notes: string | null;
  contacts: Contact[];
  timelineEvents: TimelineEvent[];
  followUpAt: string | null;
  appliedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  job: Job | null;
  inlineJobData: { title?: string; company?: string } | null;
  coverLetter: CoverLetterData | null;
}
