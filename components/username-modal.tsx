"use client";

import { useState } from "react";
import { useUser } from "@/app/providers/user-provider";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";

export function UsernameModal() {
    const { isUsernameSet, setUsername } = useUser();
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState("");

    if (isUsernameSet) {
        return null;
    }

    const handleSubmit = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) {
            setError("Please enter a nickname");
            return;
        }
        if (trimmed.length < 2) {
            setError("Nickname must be at least 2 characters");
            return;
        }
        if (trimmed.length > 30) {
            setError("Nickname must be 30 characters or less");
            return;
        }
        setUsername(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSubmit();
        }
    };

    return (
        <Dialog open={!isUsernameSet}>
            <DialogContent
                className="sm:max-w-[400px] [&>button:last-child]:hidden"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Welcome to ViewComfy
                    </DialogTitle>
                    <DialogDescription>
                        Enter a nickname to get started. This will be used to save your generation history.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="nickname">Nickname</Label>
                        <Input
                            id="nickname"
                            placeholder="Enter your nickname..."
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                setError("");
                            }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} className="w-full">
                        Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
