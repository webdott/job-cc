import { INACTIVE_STAGE_KEYS } from "@/lib/stage-constants";

// Widened from the readonly literal tuple so `.includes(app.stage)` accepts
// a plain `string` without a type error.
export const INACTIVE_STAGE_IDS: readonly string[] = INACTIVE_STAGE_KEYS;

export interface Stage {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
}

export interface StagesResponse {
  stages: Stage[];
}

export interface Evaluation {
  overallScore: number | null;
  recommendation: string | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  sourceUrl: string;
  evaluation: Evaluation | null;
}

export interface Application {
  id: string;
  stage: string;
  createdAt: string;
  lastActivityAt: string;
  job: Job | null;
  inlineJobData: { title?: string; company?: string } | null;
}

export interface ApplicationsResponse {
  applications: Application[];
}
