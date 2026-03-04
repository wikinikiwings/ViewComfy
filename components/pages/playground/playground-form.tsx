import { useFieldArray, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button";
import type { IViewComfyBase, IViewComfyWorkflow } from "@/app/providers/view-comfy-provider";
import { cn } from "@/lib/utils";
import { ViewComfyForm } from "@/components/view-comfy/view-comfy-form";
import { WandSparkles } from "lucide-react";
import "./PlaygroundForm.css";
import { useEffect, useRef } from "react";

import type { IMultiValueInput } from "@/lib/workflow-api-parser";

// In-memory cache for form values per workflow ID.
// Persists across re-renders but not page reloads.
const workflowFormCache = new Map<string, IViewComfyBase>();

// Types we consider transferable between workflows
const TRANSFERABLE_TYPES = ["long-text", "image", "video", "audio"];

/**
 * Extract all input fields from both inputs and advancedInputs,
 * flattened with their group/input indices for targeted replacement.
 */
function flattenFields(groups: IMultiValueInput[]) {
    const result: { groupIdx: number; inputIdx: number; field: IMultiValueInput["inputs"][number] }[] = [];
    for (let g = 0; g < groups.length; g++) {
        for (let i = 0; i < groups[g].inputs.length; i++) {
            result.push({ groupIdx: g, inputIdx: i, field: groups[g].inputs[i] });
        }
    }
    return result;
}

/**
 * Transfer compatible values (prompts, images) from the previous workflow's
 * form state into the new workflow's default values.
 * Matches by valueType and positional order within that type.
 */
function transferValues(prevValues: IViewComfyBase, target: IViewComfyBase): IViewComfyBase {
    // Deep-ish clone of target so we don't mutate the originals
    const result: IViewComfyBase = {
        ...target,
        inputs: target.inputs.map(g => ({
            ...g,
            inputs: g.inputs.map(inp => ({ ...inp }))
        })),
        advancedInputs: target.advancedInputs.map(g => ({
            ...g,
            inputs: g.inputs.map(inp => ({ ...inp }))
        })),
    };

    // Collect previous values by type
    const prevByType = new Map<string, unknown[]>();
    const allPrevFields = [
        ...flattenFields(prevValues.inputs),
        ...flattenFields(prevValues.advancedInputs),
    ];
    for (const { field } of allPrevFields) {
        if (TRANSFERABLE_TYPES.includes(field.valueType)) {
            const existing = prevByType.get(field.valueType) || [];
            existing.push(field.value);
            prevByType.set(field.valueType, existing);
        }
    }

    // Apply to new fields by type, in order
    const typeCounters = new Map<string, number>();
    const allNewFields = [
        ...flattenFields(result.inputs).map(f => ({ ...f, section: "inputs" as const })),
        ...flattenFields(result.advancedInputs).map(f => ({ ...f, section: "advancedInputs" as const })),
    ];

    for (const { groupIdx, inputIdx, field, section } of allNewFields) {
        if (!TRANSFERABLE_TYPES.includes(field.valueType)) continue;

        const prevValues_ = prevByType.get(field.valueType);
        if (!prevValues_ || prevValues_.length === 0) continue;

        const counter = typeCounters.get(field.valueType) || 0;
        if (counter >= prevValues_.length) continue;

        const prevValue = prevValues_[counter];
        // Always transfer if the previous value is non-empty
        if (prevValue !== null && prevValue !== undefined && prevValue !== "") {
            result[section][groupIdx].inputs[inputIdx].value = prevValue;
        }
        typeCounters.set(field.valueType, counter + 1);
    }

    return result;
}

export default function PlaygroundForm(props: {
    viewComfyJSON: IViewComfyWorkflow, onSubmit: (data: IViewComfyWorkflow) => void, loading: boolean, activeJobs?: number
}) {
    const { viewComfyJSON, onSubmit, loading, activeJobs = 0 } = props;

    const defaultValues = {
        title: viewComfyJSON.title,
        description: viewComfyJSON.description,
        textOutputEnabled: viewComfyJSON.textOutputEnabled ?? false,
        viewcomfyEndpoint: viewComfyJSON.viewcomfyEndpoint ?? "",
        showOutputFileName: viewComfyJSON.showOutputFileName ?? false,
        inputs: viewComfyJSON.inputs,
        advancedInputs: viewComfyJSON.advancedInputs,
    }

    const form = useForm<IViewComfyBase>({
        defaultValues,
        mode: "onChange",
        reValidateMode: "onChange"
    });

    const inputFieldArray = useFieldArray({
        control: form.control,
        name: "inputs"
    });

    const advancedFieldArray = useFieldArray({
        control: form.control,
        name: "advancedInputs"
    });


    // Track the previous workflow ID so we can save form state before switching
    const prevWorkflowIdRef = useRef<string>(viewComfyJSON.id);

    useEffect(() => {
        if (!viewComfyJSON) return;

        const prevId = prevWorkflowIdRef.current;
        const newId = viewComfyJSON.id;

        // Save current form values for the workflow we're leaving
        if (prevId && prevId !== newId) {
            const currentValues = form.getValues();
            // Store values directly — safe because form.reset() creates new internal state
            workflowFormCache.set(prevId, { ...currentValues });
        }

        // Build the base state: cached values if available, otherwise workflow defaults
        const cached = workflowFormCache.get(newId);
        let base: IViewComfyBase;
        if (cached) {
            base = {
                ...cached,
                title: viewComfyJSON.title,
                description: viewComfyJSON.description,
                viewcomfyEndpoint: viewComfyJSON.viewcomfyEndpoint ?? "",
            };
        } else {
            base = {
                title: viewComfyJSON.title,
                description: viewComfyJSON.description,
                textOutputEnabled: viewComfyJSON.textOutputEnabled ?? false,
                viewcomfyEndpoint: viewComfyJSON.viewcomfyEndpoint ?? "",
                showOutputFileName: viewComfyJSON.showOutputFileName ?? false,
                previewImages: viewComfyJSON.previewImages ?? [],
                inputs: viewComfyJSON.inputs,
                advancedInputs: viewComfyJSON.advancedInputs,
            };
        }

        // Always transfer current prompt/images into the target workflow
        const prevCached = workflowFormCache.get(prevId);
        if (prevCached) {
            base = transferValues(prevCached, base);
        }

        form.reset(base);

        prevWorkflowIdRef.current = newId;
    }, [viewComfyJSON, form]);


    return (
        <ViewComfyForm form={form} onSubmit={onSubmit} inputFieldArray={inputFieldArray} advancedFieldArray={advancedFieldArray} isLoading={false}>
            <Button type="submit" className="w-full">
                {activeJobs > 0 ? (
                    <>
                        Queue Generation ({activeJobs} running)
                        <WandSparkles className={cn("size-5 ml-2")} />
                    </>
                ) : (
                    <>
                        Generate <WandSparkles className={cn("size-5 ml-2")} />
                    </>
                )}
            </Button>
        </ViewComfyForm>
    )
}

