import useSWR, { mutate as globalMutate } from "swr";
import type { IGenerationRecord } from "@/app/interfaces/generation-history";

const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export function useLocalHistory(params: {
    username: string | null;
    startDate?: Date;
    endDate?: Date;
}) {
    let url: string | null = null;

    if (params.username) {
        const searchParams = new URLSearchParams();
        searchParams.set("username", params.username);

        if (params.startDate) {
            const start = new Date(params.startDate);
            start.setHours(0, 0, 0, 0);
            searchParams.set("startDate", start.toISOString());
        }

        if (params.endDate) {
            const end = new Date(params.endDate);
            end.setHours(23, 59, 59, 999);
            searchParams.set("endDate", end.toISOString());
        }

        url = `/api/history?${searchParams.toString()}`;
    }

    const { data, error, isLoading, mutate } = useSWR<IGenerationRecord[]>(
        url,
        fetcher,
        {
            refreshInterval: 0,
            revalidateOnFocus: false,
        }
    );

    return {
        history: data || null,
        isLoading,
        isError: error,
        refresh: mutate,
    };
}

/**
 * Revalidate all SWR caches matching /api/history.
 * Call this from anywhere (e.g. after saving a generation)
 * to make open history sidebars auto-update.
 */
export function refreshAllHistory() {
    // Revalidate every SWR key that starts with /api/history
    globalMutate(
        (key: unknown) => typeof key === "string" && key.startsWith("/api/history"),
        undefined,
        { revalidate: true }
    );
}

export async function saveToHistory(params: {
    username: string;
    workflowName: string;
    promptData: Record<string, unknown>;
    executionTimeSeconds: number;
    outputFiles: File[];
}): Promise<{ id: number; success: boolean } | null> {
    try {
        const formData = new FormData();
        formData.append("username", params.username);
        formData.append("workflowName", params.workflowName);
        formData.append("promptData", JSON.stringify(params.promptData));
        formData.append("executionTimeSeconds", params.executionTimeSeconds.toString());

        for (let i = 0; i < params.outputFiles.length; i++) {
            formData.append(`output_${i}`, params.outputFiles[i]);
        }

        const response = await fetch("/api/history", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            console.error("Failed to save to history:", response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to save to history:", error);
        return null;
    }
}
