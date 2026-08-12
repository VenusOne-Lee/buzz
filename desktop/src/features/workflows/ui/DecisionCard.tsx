import { Check, CornerDownLeft, ShieldAlert } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

import {
  type DecisionChoice,
  type DecisionRequest,
  type DecisionResolution,
  choiceForKey,
  describeChoice,
} from "./decisionCard.logic";

type DecisionCardProps = {
  request: DecisionRequest;
  /** Fired when a choice is made; `note` carries any typed context. */
  onDecide: (choice: DecisionChoice, note: string) => void;
  /** When set, the card renders its condensed, resolved state instead. */
  resolution?: DecisionResolution | null;
  /** Disables the choices while a resolution is in flight. */
  pending?: boolean;
  className?: string;
};

function metaEntries(request: DecisionRequest): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const meta = request.meta;
  if (meta?.actor) {
    entries.push(["Actor", meta.actor]);
  }
  if (meta?.tool) {
    entries.push(["Tool", meta.tool]);
  }
  if (meta?.target) {
    entries.push(["Scope", meta.target]);
  }
  if (request.expiresAt) {
    const at = new Date(request.expiresAt);
    if (!Number.isNaN(at.getTime())) {
      entries.push([
        "Expires",
        at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ]);
    }
  }
  return entries;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 font-mono text-badge leading-4 text-muted-foreground">
      {children}
    </kbd>
  );
}

function choiceButton(
  choice: DecisionChoice,
  index: number,
  review: boolean,
  pending: boolean | undefined,
  onDecide: (choice: DecisionChoice) => void,
) {
  const key = `${choice.type}-${index}`;
  if (choice.type === "deny") {
    return (
      <Button
        className="border-border"
        disabled={pending}
        key={key}
        onClick={() => onDecide(choice)}
        size="sm"
        variant="outline"
      >
        {choice.label}
      </Button>
    );
  }
  if (choice.type === "allow") {
    const primary = choice.scope === "once";
    return (
      <Button
        className={
          primary
            ? "bg-amber-600 text-white hover:bg-amber-700"
            : "border-amber-500/40 bg-transparent text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
        }
        disabled={pending}
        key={key}
        onClick={() => onDecide(choice)}
        size="sm"
        variant={primary ? "default" : "outline"}
      >
        {choice.label}
      </Button>
    );
  }
  return (
    <Button
      disabled={pending}
      key={key}
      onClick={() => onDecide(choice)}
      size="sm"
      variant={review ? "outline" : "default"}
    >
      {choice.label}
    </Button>
  );
}

export function DecisionCard({
  request,
  onDecide,
  resolution,
  pending,
  className,
}: DecisionCardProps) {
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const review = request.kind === "approval" || Boolean(request.review);

  if (resolution) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
        data-decision-resolved="true"
        data-testid="decision-card"
      >
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span>
          <span className="font-medium text-foreground">
            {describeChoice(resolution.choice)}
          </span>
          {resolution.by ? ` · ${resolution.by}` : null}
          {resolution.at
            ? ` · ${new Date(resolution.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : null}
        </span>
      </div>
    );
  }

  const decide = (choice: DecisionChoice) => onDecide(choice, note);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFieldSetElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || event.metaKey || event.ctrlKey) {
      return;
    }
    const choice = choiceForKey(event.key, request.choices);
    if (choice) {
      event.preventDefault();
      decide(choice);
    }
  };

  const entries = metaEntries(request);

  return (
    <fieldset
      aria-label={request.title}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        review ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card",
        className,
      )}
      data-decision-kind={request.kind}
      data-testid="decision-card"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        {review ? <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> : null}
        <span
          className={cn(
            "text-2xs font-semibold uppercase tracking-[0.14em]",
            review ? "text-amber-600" : "text-muted-foreground",
          )}
        >
          {review ? "Approval" : "Question"}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-foreground">
        {request.title}
      </p>
      {request.consequence ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {request.consequence}
        </p>
      ) : null}

      {entries.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
          {entries.map(([label, value]) => (
            <span key={label}>
              <span className="font-medium text-foreground/70">{label}</span>{" "}
              {value}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {request.choices.map((choice, index) =>
          choiceButton(choice, index, review, pending, decide),
        )}
        <Button
          className="ml-auto text-muted-foreground"
          onClick={() => setReplyOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <CornerDownLeft className="mr-1 h-3.5 w-3.5" />
          Reply
        </Button>
      </div>

      {review ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> Allow
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>M</Kbd> Mission
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>D</Kbd> Deny
          </span>
        </div>
      ) : null}

      {replyOpen ? (
        <Textarea
          aria-label="Add context to your decision"
          className="mt-2 h-16 resize-none text-xs"
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add context (attached to your decision)…"
          value={note}
        />
      ) : null}
    </fieldset>
  );
}
