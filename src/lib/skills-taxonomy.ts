/**
 * A curated list of common skill keywords used to mine "skills demanded" out of
 * free-text job descriptions for the analytics skills-gap chart.
 *
 * There is no structured "required skills" field anywhere in the data model —
 * `Job.description` is raw text and `JobEvaluation.blockA`-`blockG` only ever
 * get a `{ reason }` payload written to `blockA` by `lib/job-scorer.ts` (see
 * app/api/jobs/discover/route.ts). This list is the vocabulary we scan job
 * descriptions against; a user's own resume skills (lib/resume-parser.ts
 * `ParsedResume.skills`) are merged in on top so skills the user already has,
 * even if absent from this list, still show up as "have" when they're
 * mentioned in a job description.
 */
export const COMMON_SKILLS: string[] = [
  // Languages
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Scala",
  "SQL",

  // Frontend
  "React",
  "Next.js",
  "Vue.js",
  "Angular",
  "HTML",
  "CSS",
  "Tailwind CSS",
  "Redux",
  "React Native",

  // Backend
  "Node.js",
  "Express",
  "Django",
  "Flask",
  "Spring Boot",
  "GraphQL",
  "REST APIs",
  "Ruby on Rails",
  ".NET",
  "Microservices",

  // Data stores
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "NoSQL",

  // Cloud / DevOps
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  "Linux",
  "Bash",

  // Data / ML
  "Machine Learning",
  "Data Analysis",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "Data Visualization",
  "LLM",
  "Prompt Engineering",
  "NLP",

  // Product / Design
  "Product Management",
  "Agile",
  "Scrum",
  "Figma",
  "UX Research",
  "Wireframing",
  "A/B Testing",
  "Stakeholder Management",
  "Roadmapping",

  // Testing / QA
  "Jest",
  "Cypress",
  "Unit Testing",
  "QA",

  // Tools / other
  "Git",
  "Jira",
  "Confluence",
  "Salesforce",
  "Excel",
  "Tableau",
  "Power BI",
  "SEO",
  "Project Management",
  "Communication",
  "Leadership",
];
