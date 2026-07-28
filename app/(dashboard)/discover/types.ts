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
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  sourceUrl: string;
  fetchedAt: string;
  evaluation: JobEvaluation | null;
}

export interface JobsResponse {
  jobs: Job[];
  hasMore: boolean;
  total: number;
  page: number;
}

export interface DiscoverResponse {
  discovered: number;
  scored: number;
  total: number;
}
