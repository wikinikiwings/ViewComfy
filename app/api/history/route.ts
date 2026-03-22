import { type NextRequest, NextResponse } from "next/server";
import { saveGeneration, getGenerations, deleteGeneration, getHistoryImagesDir } from "@/lib/db";
import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

const THUMB_WIDTH = 280;
const THUMB_QUALITY = 70;
const MID_WIDTH = 1200;
const MID_QUALITY = 85;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get("username");
    if (!username) {
        return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    try {
        const generations = getGenerations({
            username,
            startDate: searchParams.get("startDate") || undefined,
            endDate: searchParams.get("endDate") || undefined,
            limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100,
            offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
        });
        return NextResponse.json(generations);
    } catch (error) {
        console.error("Failed to fetch history:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const username = formData.get("username") as string;
        const workflowName = formData.get("workflowName") as string || "";
        const promptData = JSON.parse(formData.get("promptData") as string || "{}");
        const executionTimeSeconds = parseFloat(formData.get("executionTimeSeconds") as string || "0");
        if (!username) {
            return NextResponse.json({ error: "username is required" }, { status: 400 });
        }
        const outputs: { filename: string; filepath: string; contentType: string; size: number }[] = [];
        const historyImagesDir = getHistoryImagesDir();
        for (const [key, value] of Array.from(formData.entries())) {
            if (key.startsWith("output_") && value instanceof File) {
                const file = value;
                const ext = path.extname(file.name) || getExtFromMime(file.type);
                const savedFilename = `${uuidv4()}${ext}`;
                const savedFilepath = path.join(historyImagesDir, savedFilename);
                const buffer = Buffer.from(await file.arrayBuffer());
                await fs.writeFile(savedFilepath, buffer);

                // Generate lightweight thumbnail + mid-res preview for image files
                if (file.type.startsWith("image/") && file.type !== "image/vnd.adobe.photoshop") {
                    const baseName = savedFilename.replace(/\.[^.]+$/, "");
                    // Small thumbnail for sidebar list
                    try {
                        const thumbFilename = `thumb_${baseName}.jpg`;
                        const thumbFilepath = path.join(historyImagesDir, thumbFilename);
                        await sharp(buffer)
                            .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
                            .jpeg({ quality: THUMB_QUALITY })
                            .toFile(thumbFilepath);
                    } catch (thumbError) {
                        console.error("Failed to generate thumbnail:", thumbError);
                    }
                    // Mid-resolution preview for dialog popup
                    try {
                        const midFilename = `mid_${baseName}.png`;
                        const midFilepath = path.join(historyImagesDir, midFilename);
                        await sharp(buffer)
                            .resize({ width: MID_WIDTH, withoutEnlargement: true })
                            .png({ quality: MID_QUALITY })
                            .toFile(midFilepath);
                    } catch (midError) {
                        console.error("Failed to generate mid-res preview:", midError);
                    }
                }

                outputs.push({ filename: file.name, filepath: savedFilename, contentType: file.type, size: file.size });
            }
        }
        const generationId = saveGeneration({ username, workflowName, promptData, executionTimeSeconds, outputs });
        return NextResponse.json({ id: generationId, success: true });
    } catch (error) {
        console.error("Failed to save history:", error);
        return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    if (!id || !username) {
        return NextResponse.json({ error: "id and username are required" }, { status: 400 });
    }
    try {
        const { deleted, filepaths } = deleteGeneration(parseInt(id), username);
        // Note: we intentionally keep image files on disk.
        // This only removes the record from the history database.
        return NextResponse.json({ success: deleted });
    } catch (error) {
        console.error("Failed to delete history:", error);
        return NextResponse.json({ error: "Failed to delete history" }, { status: 500 });
    }
}

function getExtFromMime(mimeType: string): string {
    const map: Record<string, string> = {
        "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
        "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/wav": ".wav",
    };
    return map[mimeType] || ".bin";
}
