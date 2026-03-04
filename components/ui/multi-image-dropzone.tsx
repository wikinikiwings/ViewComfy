/* eslint-disable @next/next/no-img-element */
import type React from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { FileUp, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MultiImageDropzoneProps {
    onChange: (files: File[]) => void;
    value?: File[];
    className?: string;
    maxFiles?: number;
    inputPlaceholder?: React.ReactNode;
}

export function MultiImageDropzone({
    onChange,
    value = [],
    className,
    maxFiles = 10,
    inputPlaceholder,
}: MultiImageDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

    const handleFiles = useCallback((incoming: FileList | File[]) => {
        const files = Array.from(incoming);
        const valid = files.filter(f =>
            imageExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
        );

        if (valid.length !== files.length) {
            setError(`Only image files are allowed (${imageExtensions.join(', ')})`);
        } else {
            setError(null);
        }

        const combined = [...value, ...valid];
        if (combined.length > maxFiles) {
            setError(`Maximum ${maxFiles} images allowed`);
            onChange(combined.slice(0, maxFiles));
        } else {
            onChange(combined);
        }
    }, [value, maxFiles, onChange]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFiles(e.target.files);
        // Reset so same file can be re-added after removal
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        const updated = value.filter((_, i) => i !== index);
        onChange(updated);
        setError(null);
    };

    const hasThumbnails = value.length > 0;

    return (
        <div className={`flex flex-col gap-1 ${className ?? ''}`}>
            {/* Drop zone */}
            <Card
                className={`border-2 border-dashed bg-muted hover:cursor-pointer transition-colors
                    ${isDragging ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'}
                    ${hasThumbnails ? 'py-2' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <CardContent className="flex flex-col items-center justify-center px-2 py-3 text-muted-foreground">
                    {inputPlaceholder ? (
                        <>
                            <span className="font-medium text-sm">{inputPlaceholder}</span>
                            <FileUp className="size-6 mt-1" />
                        </>
                    ) : (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-sm">
                                {hasThumbnails
                                    ? `Add more images (${value.length}/${maxFiles})`
                                    : 'Drag images here or click to upload'}
                            </span>
                            <FileUp className="size-5" />
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        onChange={handleFileInputChange}
                        className="hidden"
                    />
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <span className="text-red-500 text-xs px-1">{error}</span>
            )}

            {/* Thumbnails */}
            {hasThumbnails && (
                <div className="flex flex-wrap gap-1 p-1">
                    {value.map((file, index) => (
                        <Thumbnail key={`${file.name}-${index}`} file={file} onRemove={() => removeFile(index)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function Thumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [src, setSrc] = useState<string>('');

    // Read file to data URL for preview
    useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => setSrc(e.target?.result as string);
        reader.readAsDataURL(file);
    }, [file]);

    return (
        <div className="relative group w-32 h-32 rounded-md overflow-hidden border border-border flex-shrink-0 bg-muted">
            {src && (
                <img
                    src={src}
                    alt={file.name}
                    className="w-full h-full object-contain"
                    title={file.name}
                />
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="text-white hover:text-red-400 transition-colors"
                    title="Remove image"
                >
                    <X className="size-5" />
                </button>
            </div>
        </div>
    );
}
