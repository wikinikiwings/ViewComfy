import { type NextRequest, NextResponse } from "next/server";
import { getComfyPromptId, removeJob } from "@/lib/comfy-job-registry";

function getComfyBaseUrl(): string {
    const secure = process.env.COMFYUI_SECURE === "true";
    const protocol = secure ? "https://" : "http://";
    const host = process.env.COMFYUI_API_URL || "127.0.0.1:8188";
    return `${protocol}${host}`;
}

export async function POST(request: NextRequest) {
    try {
        const { jobId } = await request.json();
        if (!jobId) {
            return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        }

        const comfyPromptId = getComfyPromptId(jobId);
        if (!comfyPromptId) {
            // Job may have already completed or was never registered
            return NextResponse.json({ success: true, message: "Job not found in registry (may have already completed)" });
        }

        const baseUrl = getComfyBaseUrl();

        // Try to interrupt if currently running
        try {
            await fetch(`${baseUrl}/interrupt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt_id: comfyPromptId }),
            });
        } catch (e) {
            console.error("[Cancel] Failed to call /interrupt:", e);
        }

        // Also try to delete from queue if it's pending
        try {
            await fetch(`${baseUrl}/queue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ delete: [comfyPromptId] }),
            });
        } catch (e) {
            console.error("[Cancel] Failed to call /queue delete:", e);
        }

        // Clean up the registry
        removeJob(jobId);

        console.log(`[Cancel] Cancelled ComfyUI prompt ${comfyPromptId} for job ${jobId}`);
        return NextResponse.json({ success: true, comfyPromptId });
    } catch (error) {
        console.error("[Cancel] Error:", error);
        return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }
}
