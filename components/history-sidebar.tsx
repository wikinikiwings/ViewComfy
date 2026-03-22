"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { History, Filter, ChevronRight, Copy, FileType, File, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Collapsible,
    CollapsibleContent,
} from "@/components/ui/collapsible"
import BlurFade from "@/components/ui/blur-fade"
import { cn, fromSecondsToTime } from "@/lib/utils"
import DatePickerWithRange from "./ui/date-picker-with-range"
import { DateRange } from "react-day-picker"
import { subDays, format } from "date-fns"
import { useLocalHistory, refreshAllHistory } from "@/hooks/use-local-history"
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Play } from "lucide-react"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "./ui/skeleton"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { useUser } from "@/app/providers/user-provider"
import type { IGenerationRecord } from "@/app/interfaces/generation-history"

interface HistorySidebarProps {
    open: boolean
    setOpen: (open: boolean) => void
    className?: string
}

export function HistorySidebar({ open, setOpen, className }: HistorySidebarProps) {
    if (!open) {
        return null;
    }

    return <HistorySidebarContent open={open} setOpen={setOpen} className={className} />;
}

export function HistorySidebarContent({ open, setOpen, className }: HistorySidebarProps) {
    const [showFilters, setShowFilters] = useState(false);
    const { username } = useUser();
    const today = new Date();
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(today, 7),
        to: today,
    });

    const {
        history,
        isLoading,
        isError,
        loadMore,
        hasMore,
        isLoadingMore,
    } = useLocalHistory({
        username,
        startDate: date?.from,
        endDate: date?.to,
    });

    if (!open) {
        return null;
    }

    const getTotalSize = (generation: IGenerationRecord) => {
        if (!generation.outputs || generation.outputs.length === 0) {
            return "0.00";
        }
        const sizeInBytes = generation.outputs.reduce((acc, output) => acc + output.size, 0);
        const sizeInMB = sizeInBytes / (1024 * 1024);
        return sizeInMB.toFixed(2);
    }

    const copyPrompt = (promptDataStr: string) => {
        let textToCopy = promptDataStr;
        try {
            const promptData = JSON.parse(promptDataStr);
            textToCopy = formatPromptForCopy(promptData);
        } catch {
            // Use raw string if parsing fails
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                toast.success("Prompt copied to clipboard", { duration: 2000 });
            }).catch(() => {
                fallbackCopy(textToCopy);
            });
        } else {
            fallbackCopy(textToCopy);
        }
    };

    const handleDelete = async (generationId: number) => {
        if (!username) return;
        try {
            const res = await fetch(`/api/history?id=${generationId}&username=${encodeURIComponent(username)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Deleted from history", { duration: 2000 });
                refreshAllHistory();
            } else {
                toast.error("Failed to delete", { duration: 2000 });
            }
        } catch {
            toast.error("Failed to delete", { duration: 2000 });
        }
    };

    const fallbackCopy = (text: string) => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            toast.success("Prompt copied to clipboard", { duration: 2000 });
        } catch {
            toast.error("Failed to copy prompt", { duration: 2000 });
        }
        document.body.removeChild(textarea);
    };

    return (
        <div className={cn("h-full w-[340px] sm:w-[340px] bg-background border flex flex-col rounded-xl shadow-md", className)}>
            <div className="border-b">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <History className="h-5 w-5" />
                        <span className="font-semibold">Generation History</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="gap-2"
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                        </Button>
                    </div>
                </div>
                {username && (
                    <div className="px-4 pb-2 text-xs text-muted-foreground">
                        Showing history for: <span className="font-medium text-foreground">{username}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col overflow-y-hidden">
                <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                    <CollapsibleContent className="space-y-4 p-4 border-b">
                        <div className="space-y-4">
                            <DatePickerWithRange
                                dateRange={date}
                                setDate={setDate}
                                disabled={false}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                <ScrollArea className="flex-1 p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex flex-col space-y-3">
                                <Skeleton className="h-[125px] w-[250px] rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[200px]" />
                                    <Skeleton className="h-4 w-[250px]" />
                                </div>
                                <div className="flex flex-col space-y-3">
                                    <Skeleton className="h-[125px] w-[250px] rounded-xl" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-[200px]" />
                                        <Skeleton className="h-4 w-[250px]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : history && history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <History className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No history found</h3>
                            <p className="text-sm text-muted-foreground">
                                Your generation history will appear here
                            </p>
                        </div>
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <History className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Error loading history</h3>
                            <p className="text-sm text-muted-foreground">
                                Please try again later
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center space-y-4 mt-2">
                            {history?.map(
                                (generation: IGenerationRecord) => (
                                    <div key={generation.id}>
                                        <div className="flex flex-col items-center justify-center">
                                            <BlurFade key={generation.id + "blur-fade"} delay={0.23} inView>
                                                <OutputPreview
                                                    key={generation.id + "output-preview"}
                                                    outputs={generation.outputs}
                                                />
                                            </BlurFade>
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1 flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                Total size: {getTotalSize(generation)} MB
                                                {" - "}
                                                Prompt: <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-5 w-5"
                                                                onClick={() =>
                                                                    copyPrompt(generation.prompt_data)
                                                                }
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-center">
                                                            <p>Copy prompt to clipboard</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                                                            onClick={() => handleDelete(generation.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="text-center">
                                                        <p>Remove from history</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        {/* Show prompt preview */}
                                        <PromptPreview promptData={generation.prompt_data} />
                                        <div className="text-sm text-muted-foreground">
                                            execution time: {fromSecondsToTime(generation.execution_time_seconds)}
                                            {" - "}
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(generation.created_at), "dd/M/yyyy HH:mm:ss")}
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}
                            {hasMore && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={loadMore}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? "Loading..." : "Load more"}
                                </Button>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    )
}

// Component to show just the prompt text
function PromptPreview({ promptData }: { promptData: string }) {
    const promptText = extractPromptText(promptData);

    if (!promptText) {
        return null;
    }

    const truncated = promptText.length > 120
        ? promptText.substring(0, 120) + "..."
        : promptText;

    return (
        <div className="mt-1 mb-1">
            <p className="text-xs text-muted-foreground italic">{truncated}</p>
        </div>
    );
}

// Extract just the prompt text from stored prompt data
function extractPromptText(promptDataStr: string): string | null {
    try {
        const parsed = JSON.parse(promptDataStr);
        // Look for keys that contain "text" but not "text_negative" or other variants
        const textKeys = Object.keys(parsed).filter(k => {
            const cleaned = k.replace(/^\d+-inputs-/, "").replace(/^\d+-/, "");
            return cleaned === "text" || cleaned === "prompt";
        });
        if (textKeys.length > 0) {
            const value = parsed[textKeys[0]];
            return typeof value === "string" ? value : null;
        }
        return null;
    } catch {
        return null;
    }
}

function formatPromptForCopy(promptData: Record<string, unknown>): string {
    // Only copy the prompt text, not all parameters
    const textKeys = Object.keys(promptData).filter(k => {
        const cleaned = k.replace(/^\d+-inputs-/, "").replace(/^\d+-/, "");
        return cleaned === "text" || cleaned === "prompt";
    });
    if (textKeys.length > 0) {
        const value = promptData[textKeys[0]];
        if (typeof value === "string") return value;
    }
    // Fallback: return raw JSON if no text field found
    return JSON.stringify(promptData, null, 2);
}

type OutputRecord = IGenerationRecord["outputs"][number];

function OutputPreview({ outputs }: { outputs: OutputRecord[] }) {
    const [blobIndex, setBlobIndex] = useState(0);
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const [imageNaturalWidth, setImageNaturalWidth] = useState<number>(0);
    const [imageNaturalHeight, setImageNaturalHeight] = useState<number>(0);
    const failedMidUrls = useRef<Set<string>>(new Set());
    const scaleUp = false;
    const zoomFactor = 8;

    const imageScale = useMemo((): number => {
        if (
            containerWidth === 0 ||
            containerHeight === 0 ||
            imageNaturalWidth === 0 ||
            imageNaturalHeight === 0
        )
            return 0;
        const scale = Math.min(
            containerWidth / imageNaturalWidth,
            containerHeight / imageNaturalHeight,
        );
        return scaleUp ? scale : Math.max(scale, 1);
    }, [scaleUp, containerWidth, containerHeight, imageNaturalWidth, imageNaturalHeight]);

    // Full-resolution URL
    const getImageUrl = (output: OutputRecord) => {
        return `/api/history/image/${output.filepath}`;
    };

    // Lightweight thumbnail URL (falls back to full image if thumb doesn't exist)
    const getThumbUrl = (output: OutputRecord) => {
        const name = output.filepath;
        const baseName = name.replace(/\.[^.]+$/, "");
        return `/api/history/image/thumb_${baseName}.jpg`;
    };

    // Mid-resolution URL for dialog preview (falls back to full image)
    const getMidUrl = (output: OutputRecord) => {
        const name = output.filepath;
        const baseName = name.replace(/\.[^.]+$/, "");
        return `/api/history/image/mid_${baseName}.png`;
    };

    const isImageByMimeType = (output: OutputRecord) => {
        return output.content_type.startsWith("image/") && output.content_type !== "image/vnd.adobe.photoshop";
    };

    useEffect(() => {
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                setContainerHeight(entry.contentRect.height);
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [container]);

    const handleImageOnLoad = (image: HTMLImageElement) => {
        setImageNaturalWidth(image.naturalWidth);
        setImageNaturalHeight(image.naturalHeight);
    };

    useEffect(() => {
        if (!outputs || outputs.length === 0 || !isImageByMimeType(outputs[blobIndex])) {
            return;
        }
        const midUrl = getMidUrl(outputs[blobIndex]);
        const image = new Image();
        image.onload = () => handleImageOnLoad(image);
        image.onerror = () => {
            image.onerror = null;
            failedMidUrls.current.add(midUrl);
            image.src = getImageUrl(outputs[blobIndex]);
        };
        if (failedMidUrls.current.has(midUrl)) {
            image.src = getImageUrl(outputs[blobIndex]);
        } else {
            image.src = midUrl;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blobIndex, outputs]);

    if (!outputs || outputs.length === 0) {
        return null;
    }

    const previewOutput = outputs[0];

    const goToPrevious = () => {
        setBlobIndex(prev => (prev > 0 ? prev - 1 : outputs.length - 1));
    };

    const goToNext = () => {
        setBlobIndex(prev => (prev < outputs.length - 1 ? prev + 1 : 0));
    };

    // Drag handler — always uses the full-resolution original URL
    const handleDragStart = (e: React.DragEvent<HTMLElement>, output: OutputRecord) => {
        const mediaData: import("@/lib/drag-utils").DraggableMediaData = {
            url: getImageUrl(output),
            filename: output.filename,
            contentType: output.content_type,
        };
        e.dataTransfer.setData("application/x-viewcomfy-media", JSON.stringify(mediaData));
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div className="relative inline-block">
            <Dialog onOpenChange={() => setBlobIndex(0)}>
                <DialogTrigger asChild>
                    <div key={previewOutput.id + "preview-trigger"}>
                        {isImageByMimeType(previewOutput) && (
                            <img
                                src={getThumbUrl(previewOutput)}
                                alt="Output image"
                                width={140}
                                height={140}
                                loading="lazy"
                                draggable
                                onDragStart={(e) => handleDragStart(e, previewOutput)}
                                onError={(e) => { (e.target as HTMLImageElement).src = getImageUrl(previewOutput); }}
                                className="rounded-md transition-all hover:scale-105 hover:cursor-pointer"
                            />
                        )}
                        {previewOutput.content_type.startsWith("video/") && (
                            <video
                                key={previewOutput.id}
                                className="object-contain rounded-md hover:cursor-pointer transition-all hover:scale-105"
                                width={100}
                                height={100}
                            >
                                <source src={getImageUrl(previewOutput)} />
                            </video>
                        )}
                        {previewOutput.content_type.startsWith("audio/") && (
                            <Button variant="outline">
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                        {previewOutput.content_type === "image/vnd.adobe.photoshop" && (
                            <Button variant="outline">
                                <File className="h-10 w-10" />
                            </Button>
                        )}
                        {previewOutput.content_type.startsWith("text/") && (
                            <Button variant="outline">
                                <FileType className="h-10 w-10" />
                            </Button>
                        )}
                    </div>
                </DialogTrigger>
                <DialogContent className="max-w-fit max-h-[90vh] border-0 p-0 bg-transparent [&>button]:bg-background [&>button]:border [&>button]:border-border [&>button]:rounded-full [&>button]:p-1 [&>button]:shadow-md">
                    <DialogTitle className="sr-only">Image preview</DialogTitle>
                    <div className="relative">
                        {isImageByMimeType(outputs[blobIndex]) && (
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor: "black",
                                    cursor: "zoom-in"
                                }}
                                ref={(el: HTMLDivElement | null) => setContainer(el)}
                            >
                                <TransformWrapper
                                    key={`${containerWidth}x${containerHeight}`}
                                    initialScale={imageScale}
                                    minScale={imageScale}
                                    maxScale={imageScale * zoomFactor}
                                    centerOnInit
                                >
                                    <TransformComponent
                                        wrapperStyle={{ width: "100%", height: "100%" }}
                                    >
                                        <img
                                            key={outputs[blobIndex].id}
                                            src={failedMidUrls.current.has(getMidUrl(outputs[blobIndex])) ? getImageUrl(outputs[blobIndex]) : getMidUrl(outputs[blobIndex])}
                                            alt={outputs[blobIndex].filename}
                                            onError={(e) => {
                                                const midUrl = getMidUrl(outputs[blobIndex]);
                                                if (!failedMidUrls.current.has(midUrl)) {
                                                    failedMidUrls.current.add(midUrl);
                                                    (e.target as HTMLImageElement).src = getImageUrl(outputs[blobIndex]);
                                                }
                                            }}
                                            className="max-h-[85vh] w-auto object-contain rounded-md"
                                        />
                                    </TransformComponent>
                                </TransformWrapper>
                            </div>
                        )}
                        {outputs[blobIndex].content_type.startsWith("video/") && (
                            <video
                                key={outputs[blobIndex].id}
                                className="max-h-[85vh] w-auto object-contain rounded-md"
                                controls
                            >
                                <source src={getImageUrl(outputs[blobIndex])} />
                            </video>
                        )}
                        {outputs[blobIndex].content_type.startsWith("audio/") && (
                            <div className="m-20">
                                <audio key={outputs[blobIndex].id} controls>
                                    <source src={getImageUrl(outputs[blobIndex])} />
                                </audio>
                            </div>
                        )}
                        {outputs[blobIndex].content_type === "image/vnd.adobe.photoshop" && (
                            <div className="m-20">
                                <File className="h-20 w-20" />
                            </div>
                        )}
                        {outputs[blobIndex].content_type.startsWith("text/") && (
                            <div className="m-20">
                                <FileType className="h-20 w-20" />
                            </div>
                        )}
                        {outputs.length > 1 && (
                            <>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-accent border border-border rounded-full p-2 shadow-md z-10"
                                    onClick={goToPrevious}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-accent border border-border rounded-full p-2 shadow-md z-10"
                                    onClick={goToNext}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        {outputs.length > 1 && (
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10">
                                {blobIndex + 1} / {outputs.length}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="bg-transparent">
                        <Button
                            className="w-full"
                            onClick={() => {
                                const link = document.createElement("a");
                                link.href = getImageUrl(outputs[blobIndex]);
                                link.download = outputs[blobIndex].filename;
                                link.click();
                            }}
                        >
                            Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Badge className="absolute -bottom-1 -right-1 px-2 py-1 min-w-[20px] h-5 flex items-center justify-center z-10">
                {outputs.length}
            </Badge>
        </div>
    );
}
