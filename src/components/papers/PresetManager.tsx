"use client";

import { BookmarkPlus, Check, Edit2, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button, Select, TextInput, useToast } from "@/components/ui";
import {
  usePaperPresets,
  type PaperPresetSpec,
} from "@/hooks/use-paper-presets";

interface PresetManagerProps {
  currentSpec: PaperPresetSpec;
  onApplyPreset: (spec: PaperPresetSpec) => void;
  showBottomSaveOption?: boolean;
  scope?: "builder" | "regenerate";
}

export default function PresetManager({
  currentSpec,
  onApplyPreset,
  showBottomSaveOption: _showBottomSaveOption = true,
  scope,
}: PresetManagerProps) {
  const toast = useToast();
  const { presets, savePreset, updatePreset, deletePreset } = usePaperPresets(scope);

  const [selectedId, setSelectedId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSelectPreset = (value: string) => {
    if (value === "__SAVE_NEW__") {
      setPresetName("");
      setIsCreating(true);
      setIsEditing(false);
      return;
    }

    setSelectedId(value);
    setIsCreating(false);
    setIsEditing(false);

    if (!value) return;

    const target = presets.find((p) => p.id === value);
    if (target) {
      onApplyPreset(target.spec);
      toast.success(`Loaded preset: ${target.name}`);
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) {
      toast.error("Please enter a preset name.");
      return;
    }

    if (isEditing && selectedId) {
      const updated = updatePreset(selectedId, presetName.trim(), {
        ...currentSpec,
        scope: scope || currentSpec.scope,
      });
      setIsEditing(false);
      setPresetName("");
      if (updated) {
        toast.success(`Preset "${updated.name}" updated successfully.`);
      }
      return;
    }

    const created = savePreset(presetName.trim(), {
      ...currentSpec,
      scope: scope || currentSpec.scope,
    });
    setSelectedId(created.id);
    setPresetName("");
    setIsCreating(false);
    toast.success(`Preset "${created.name}" saved.`);
  };

  const handleStartEdit = () => {
    const target = presets.find((p) => p.id === selectedId);
    if (!target || target.isBuiltIn) return;
    setPresetName(target.name);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleDelete = (id: string, name: string) => {
    deletePreset(id);
    if (selectedId === id) setSelectedId("");
    setIsEditing(false);
    toast.info(`Deleted preset "${name}".`);
  };

  const currentPreset = presets.find((p) => p.id === selectedId);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <SlidersHorizontal className="h-4 w-4 text-slate-600" />
          <span>Presets</span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 min-w-[220px]">
          <Select
            value={selectedId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="py-1 text-xs bg-white flex-1"
          >
            <option value="">Choose a preset…</option>
            <optgroup label="Built-in Presets">
              {presets
                .filter((p) => p.isBuiltIn)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
            {presets.some((p) => !p.isBuiltIn) ? (
              <optgroup label="Saved Presets">
                {presets
                  .filter((p) => !p.isBuiltIn)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup label="Actions">
              <option value="__SAVE_NEW__">+ Save current as preset…</option>
            </optgroup>
          </Select>

          {/* Edit & Delete controls for saved custom presets */}
          {currentPreset && !currentPreset.isBuiltIn ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartEdit}
                title="Edit / Update preset name or parameters"
                className="py-1 px-2 text-xs text-slate-700 hover:bg-slate-200"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleDelete(currentPreset.id, currentPreset.name)}
                title="Delete preset"
                className="py-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline Form to name preset when creating or editing from top bar */}
      {(isCreating || isEditing) && (
        <form onSubmit={handleSaveSubmit} className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
          <TextInput
            autoFocus
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Enter preset name…"
            className="py-1 text-xs flex-1 bg-white"
          />
          <Button type="submit" className="py-1 px-3 text-xs bg-slate-900 text-white">
            <Check className="h-3.5 w-3.5 mr-1" />
            {isEditing ? "Update" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsCreating(false);
              setIsEditing(false);
              setPresetName("");
            }}
            className="py-1 px-2 text-xs text-slate-500"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}

export function SavePresetBottomBar({
  currentSpec,
  scope,
}: {
  currentSpec: PaperPresetSpec;
  scope?: "builder" | "regenerate";
}) {
  const toast = useToast();
  const { savePreset } = usePaperPresets(scope);

  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) {
      toast.error("Please enter a preset name.");
      return;
    }

    const created = savePreset(presetName.trim(), {
      ...currentSpec,
      scope: scope || currentSpec.scope,
    });
    setPresetName("");
    setIsSaving(false);
    toast.success(`Preset "${created.name}" saved for future use!`);
  };


  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3">
      {!isSaving ? (
        <button
          type="button"
          onClick={() => {
            setPresetName("");
            setIsSaving(true);
          }}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-slate-700 hover:text-brand-700 transition"
        >
          <span className="flex items-center gap-2">
            <BookmarkPlus className="h-4 w-4 text-brand-600" />
            Save these settings as a preset for future use
          </span>
          <span className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition shrink-0">
            Save Preset
          </span>
        </button>
      ) : (
        <form onSubmit={handleSaveSubmit} className="flex items-center gap-2">
          <TextInput
            autoFocus
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Enter preset name (e.g. SSC Model Test)"
            className="py-1.5 text-xs flex-1 bg-white"
          />
          <Button type="submit" className="py-1.5 px-3 text-xs bg-brand-600 text-white">
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsSaving(false);
              setPresetName("");
            }}
            className="py-1.5 px-2 text-xs text-slate-500"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}
