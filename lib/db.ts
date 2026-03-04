import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { IGenerationRecord } from "@/app/interfaces/generation-history";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "history.db");

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const HISTORY_IMAGES_DIR = path.join(DB_DIR, "history_images");
if (!fs.existsSync(HISTORY_IMAGES_DIR)) {
    fs.mkdirSync(HISTORY_IMAGES_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
    if (!_db) {
        _db = new Database(DB_PATH);
        _db.pragma("journal_mode = WAL");
        _db.pragma("foreign_keys = ON");
        initDb(_db);
    }
    return _db;
}

function initDb(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS generations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            workflow_name TEXT DEFAULT '',
            prompt_data TEXT DEFAULT '{}',
            execution_time_seconds REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'completed'
        );
        CREATE TABLE IF NOT EXISTS generation_outputs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            generation_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            content_type TEXT NOT NULL,
            size INTEGER DEFAULT 0,
            FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_generations_username ON generations(username);
        CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_outputs_generation_id ON generation_outputs(generation_id);
    `);
}

export type { IGenerationRecord };

export interface ISaveGenerationParams {
    username: string;
    workflowName: string;
    promptData: Record<string, unknown>;
    executionTimeSeconds: number;
    outputs: { filename: string; filepath: string; contentType: string; size: number }[];
}

export function saveGeneration(params: ISaveGenerationParams): number {
    const db = getDb();
    const insertGeneration = db.prepare(
        `INSERT INTO generations (username, workflow_name, prompt_data, execution_time_seconds) VALUES (?, ?, ?, ?)`
    );
    const insertOutput = db.prepare(
        `INSERT INTO generation_outputs (generation_id, filename, filepath, content_type, size) VALUES (?, ?, ?, ?, ?)`
    );
    const transaction = db.transaction(() => {
        const result = insertGeneration.run(
            params.username, params.workflowName, JSON.stringify(params.promptData), params.executionTimeSeconds
        );
        const generationId = result.lastInsertRowid as number;
        for (const output of params.outputs) {
            insertOutput.run(generationId, output.filename, output.filepath, output.contentType, output.size);
        }
        return generationId;
    });
    return transaction();
}

export function getGenerations(params: {
    username: string; startDate?: string; endDate?: string; limit?: number; offset?: number;
}): IGenerationRecord[] {
    const db = getDb();
    let query = `SELECT * FROM generations WHERE username = ?`;
    const queryParams: (string | number)[] = [params.username];
    if (params.startDate) { query += ` AND created_at >= ?`; queryParams.push(params.startDate); }
    if (params.endDate) { query += ` AND created_at <= ?`; queryParams.push(params.endDate); }
    query += ` ORDER BY created_at DESC`;
    if (params.limit) { query += ` LIMIT ?`; queryParams.push(params.limit); }
    if (params.offset) { query += ` OFFSET ?`; queryParams.push(params.offset); }

    const generations = db.prepare(query).all(...queryParams) as IGenerationRecord[];
    const getOutputs = db.prepare(`SELECT * FROM generation_outputs WHERE generation_id = ?`);
    for (const gen of generations) {
        gen.outputs = getOutputs.all(gen.id) as IGenerationRecord["outputs"];
    }
    return generations;
}

export function deleteGeneration(id: number, username: string): { deleted: boolean; filepaths: string[] } {
    const db = getDb();
    // Get output filepaths before deleting so we can clean up files
    const outputs = db.prepare(`SELECT filepath FROM generation_outputs WHERE generation_id = ?`).all(id) as { filepath: string }[];
    const filepaths = outputs.map(o => o.filepath);
    const result = db.prepare(`DELETE FROM generations WHERE id = ? AND username = ?`).run(id, username);
    return { deleted: result.changes > 0, filepaths };
}

export function getHistoryImagesDir(): string {
    return HISTORY_IMAGES_DIR;
}
