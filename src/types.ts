export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  uid: string; // Added for ownership
  title: string;
  description?: string;
  duration: string;
  due: string;
  priority: Priority;
  status: Status;
  progress?: number;
  startTime?: string;
  endTime?: string;
  createdAt: number; // Added for sorting
}

export interface WeeklyVelocity {
  day: string;
  done: number;
  remaining: number;
}
