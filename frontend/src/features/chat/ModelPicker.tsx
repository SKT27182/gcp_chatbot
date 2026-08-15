import { Check, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ModelInfo } from "@/lib/api"
import { cn } from "@/lib/utils"

type ModelPickerProps = {
  models: ModelInfo[]
  selectedId: string | null
  loading?: boolean
  error?: boolean
  disabled?: boolean
  onSelect: (modelId: string) => void
}

export function ModelPicker({
  models,
  selectedId,
  loading,
  error,
  disabled,
  onSelect,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = models.find((m) => m.id === selectedId) ?? models[0]
  const groups = useMemo(() => {
    const byFamily = new Map<string, ModelInfo[]>()
    for (const model of models) {
      const bucket = byFamily.get(model.family) ?? []
      bucket.push(model)
      byFamily.set(model.family, bucket)
    }
    return Array.from(byFamily.entries())
  }, [models])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (!selected) {
    const label = error ? "Couldn't load models" : loading ? "Loading models" : "No models"
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        {label}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex max-w-[220px] items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors",
          "hover:border-border hover:bg-muted/70 hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
        title={selected.label}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-70", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-xl border border-border/80 bg-card py-1 shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto">
            {groups.map(([family, items]) => (
              <div key={family} className="px-1 py-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {family}
                </p>
                {items.map((model) => {
                  const isActive = model.id === selected.id
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onSelect(model.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <span className="truncate">{model.label}</span>
                      {isActive ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
