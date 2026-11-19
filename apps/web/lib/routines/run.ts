import { claimDueRoutines } from "./repo";

/** Claims routines that are due. (The runner that does their work arrives in the next task.) */
export async function startDueRoutines(now: Date): Promise<void> {
  await claimDueRoutines(now);
}
