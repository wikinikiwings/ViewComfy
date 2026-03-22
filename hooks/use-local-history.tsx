import useSWR, { mutate as globalMutate } from "swr";
import type { IGenerationRecord } from "@/app/interfaces/generation-history";
import { useState, useCallback } from "react";

const PAGE_SIZE = 20;

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
    const [allHistory, setAllHistory] = useState<IGenerationRecord[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Build the base URL for SWR (first page only)
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
        searchParams.set("limit", String(PAGE_SIZE));
        searchParams.set("offset", "0");
        url = `/api/history?${searchParams.toString()}`;
    }

    const { data, error, isLoading, mutate } = useSWR<IGenerationRecord[]>(
        url,
        fetcher,
        {
            refreshInterval: 0,
            revalidateOnFocus: false,
            onSuccess: (freshData) => {
                // Reset accumulated history when SWR fetches fresh first page
                setAllHistory(freshData);
                setHasMore(freshData.length >= PAGE_SIZE);
            },
        }
    );

    const loadMore = useCallback(async () => {
        if (!params.username || isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
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
            searchParams.set("limit", String(PAGE_SIZE));
            searchParams.set("offset", String(allHistory.length));

            const response = await fetch(`/api/history?${searchParams.toString()}`);
            if (!response.ok) throw new Error("Failed to load more");
            const moreData: IGenerationRecord[] = await response.json();

            setAllHistory(prev => [...prev, ...moreData]);
            setHasMore(moreData.length >= PAGE_SIZE);
        } catch (err) {
            console.error("Failed to load more history:", err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [params.username, params.startDate, params.endDate, allHistory.length, isLoadingMore, hasMore]);

    return {
        history: allHistory.length > 0 ? allHistory : (data || null),
        isLoading,
        isError: error,
        refresh: mutate,
        loadMore,
        hasMore,
        isLoadingMore,
    };
}

/**
 * Debounced revalidation of all SWR caches matching /api/history.
 * Multiple rapid calls (e.g. several generations completing back-to-back)
 * are collapsed into a single refresh after a short delay.
 */
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_MS = 1500;

export function refreshAllHistory() {
    if (_refreshTimer) {
        clearTimeout(_refreshTimer);
    }
    _refreshTimer = setTimeout(() => {
        _refreshTimer = null;
        globalMutate(
            (key: unknown) => typeof key === "string" && key.startsWith("/api/history"),
            undefined,
            { revalidate: true }
        );
    }, REFRESH_DEBOUNCE_MS);
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
