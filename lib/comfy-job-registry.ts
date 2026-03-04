/**
 * In-memory registry mapping frontend jobId → ComfyUI prompt_id.
 * Used to cancel ComfyUI prompts when the user cancels from the UI.
 * Entries are cleaned up after completion or cancellation.
 */

const jobRegistry = new Map<string, string>();

export function registerJob(jobId: string, comfyPromptId: string) {
    jobRegistry.set(jobId, comfyPromptId);
}

export function getComfyPromptId(jobId: string): string | undefined {
    return jobRegistry.get(jobId);
}

export function removeJob(jobId: string) {
    jobRegistry.delete(jobId);
}
