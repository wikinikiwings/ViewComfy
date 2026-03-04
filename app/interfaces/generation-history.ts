// Shared types for generation history — safe to import from both client and server

export interface IGenerationOutput {
    id: number;
    generation_id: number;
    filename: string;
    filepath: string;
    content_type: string;
    size: number;
}

export interface IGenerationRecord {
    id: number;
    username: string;
    workflow_name: string;
    prompt_data: string;
    execution_time_seconds: number;
    created_at: string;
    status: string;
    outputs: IGenerationOutput[];
}
