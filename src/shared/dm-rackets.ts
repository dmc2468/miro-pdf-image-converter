export interface DmRacketJob {
  id: string;
  jobNumber: number;
  date: string;
  racket: string;
  mains: string;
  crosses: string;
  tension: string;
  notes: string;
}

export function nextDmJobNumber(jobs: DmRacketJob[]): number {
  return Math.max(0, ...jobs.map(job => job.jobNumber)) + 1;
}

export function dmSavings(jobs: DmRacketJob[]): number {
  return jobs.length * 25;
}

export function sortedDmJobs(jobs: DmRacketJob[]): DmRacketJob[] {
  return [...jobs].sort((a, b) => b.jobNumber - a.jobNumber);
}
