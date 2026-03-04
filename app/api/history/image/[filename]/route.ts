import { type NextRequest, NextResponse } from "next/server";
import { getHistoryImagesDir } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;
    const sanitized = path.basename(filename);
    const filepath = path.join(getHistoryImagesDir(), sanitized);

    if (!fs.existsSync(filepath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filepath);
    const contentType = mime.lookup(sanitized) || "application/octet-stream";

    return new NextResponse(fileBuffer, {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
