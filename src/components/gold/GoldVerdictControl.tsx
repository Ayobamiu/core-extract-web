"use client";

import React, { useEffect, useState } from "react";
import { Button, Input, Popover, Tag, Tooltip } from "antd";
import { Check, CircleSlash, EyeOff, Loader2, X } from "lucide-react";
import type { GoldLabel, GoldVerdict } from "@/lib/api";
import { isBlankValue } from "@/lib/goldSetPaths";

/**
 * The per-field verdict control that lives on a JSON tree node in review mode.
 *
 * The wording of the buttons is load-bearing, not decoration. The single
 * most-missed rule in a gold set is that a field which is blank in the
 * extraction AND blank on the page is CORRECT — many fields are legitimately
 * absent (`screen_from_ft` is ~41% filled because most borings aren't wells),
 * and a reviewer who reflexively marks those `missing` manufactures an
 * accuracy collapse that says nothing about the pipeline.
 *
 * So a blank value never shows a bare ✓/✗. It asks the question that actually
 * has to be answered: is the page blank here too?
 */

const VERDICT_STYLE: Record<GoldVerdict, { label: string; color: string }> = {
  correct: { label: "Correct", color: "green" },
  wrong: { label: "Wrong", color: "red" },
  missing: { label: "Missing", color: "orange" },
  unreadable: { label: "Unreadable", color: "default" },
};

export interface GoldVerdictControlProps {
  /** Undefined for a container node: the seeded leaves beneath it are judged. */
  label?: GoldLabel;
  fieldPath: string;
  /** How many seeded leaves this click would judge (1 for a plain field). */
  targetCount: number;
  saving?: boolean;
  onReview: (
    fieldPath: string,
    verdict: GoldVerdict | null,
    opts?: { trueValue?: string | null; notes?: string | null },
  ) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const GoldVerdictControl: React.FC<GoldVerdictControlProps> = ({
  label,
  fieldPath,
  targetCount,
  saving = false,
  onReview,
  open,
  onOpenChange,
}) => {
  const [trueValue, setTrueValue] = useState(label?.true_value ?? "");
  // Which verdict the true-value prompt will save. `wrong` and `missing` both
  // mean "the page says something we didn't capture", so both are worth the
  // extra keystroke — that answer is what makes a finding actionable later.
  const [askingTrueValue, setAskingTrueValue] = useState<"wrong" | "missing" | null>(null);

  useEffect(() => {
    setTrueValue(label?.true_value ?? "");
    setAskingTrueValue(null);
  }, [label?.id, label?.true_value]);

  const blank = isBlankValue(label?.extracted_value);
  const isContainer = !label;

  const submit = (verdict: GoldVerdict | null, value?: string | null) => {
    onReview(fieldPath, verdict, { trueValue: value ?? null });
    setAskingTrueValue(null);
    onOpenChange?.(false);
  };

  const content = (
    <div className="w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="text-[11px] font-mono text-gray-500 break-all">{fieldPath}</div>

      {isContainer ? (
        <div className="text-xs text-gray-600">
          Judges the {targetCount} sampled field{targetCount === 1 ? "" : "s"} inside this
          node — one verdict each, so the score is unchanged.
        </div>
      ) : (
        <div className="text-xs">
          <span className="text-gray-500">Extracted: </span>
          {blank ? (
            <span className="italic text-gray-400">blank</span>
          ) : (
            <span className="font-mono break-all">{label?.extracted_value}</span>
          )}
        </div>
      )}

      {label?.drifted && (
        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-800">
          Changed since this batch was seeded — now{" "}
          <span className="font-mono">{label.current_value ?? "blank"}</span>. Judge the
          seeded value above, or reload the batch.
        </div>
      )}

      {askingTrueValue ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">What does the page actually say?</div>
          <Input
            size="small"
            autoFocus
            value={trueValue}
            placeholder="value on the page"
            onChange={(e) => setTrueValue(e.target.value)}
            onPressEnter={() => submit(askingTrueValue, trueValue)}
          />
          <div className="flex gap-2">
            <Button
              size="small"
              type="primary"
              onClick={() => submit(askingTrueValue, trueValue)}
            >
              Save as {askingTrueValue}
            </Button>
            <Button size="small" onClick={() => setAskingTrueValue(null)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Button
            size="small"
            block
            icon={<Check className="w-3.5 h-3.5" />}
            onClick={() => submit("correct")}
          >
            {blank && !isContainer ? "Blank on the page too" : "Matches the page"}
          </Button>

          {blank && !isContainer ? (
            <Button
              size="small"
              block
              danger
              icon={<CircleSlash className="w-3.5 h-3.5" />}
              onClick={() => setAskingTrueValue("missing")}
            >
              The page has a value
            </Button>
          ) : (
            <Button
              size="small"
              block
              danger
              icon={<X className="w-3.5 h-3.5" />}
              onClick={() => (isContainer ? submit("wrong") : setAskingTrueValue("wrong"))}
            >
              Doesn&apos;t match the page
            </Button>
          )}

          <Button
            size="small"
            block
            icon={<EyeOff className="w-3.5 h-3.5" />}
            onClick={() => submit("unreadable")}
          >
            Can&apos;t tell — scan illegible
          </Button>

          {label?.verdict && (
            <Button size="small" block type="text" onClick={() => submit(null)}>
              Clear verdict
            </Button>
          )}
        </div>
      )}

      <div className="text-[10px] text-gray-400 leading-snug">
        Format differences (5 vs 5 ft, 5.0 vs 5) are correct. A value found elsewhere in
        the same section is correct. Unreadable is excluded from the score.
      </div>
    </div>
  );

  const chip = saving ? (
    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
  ) : label?.verdict ? (
    <Tag
      color={VERDICT_STYLE[label.verdict].color}
      className="!mr-0 !px-1 !py-0 !text-[10px] !leading-4 cursor-pointer"
    >
      {VERDICT_STYLE[label.verdict].label}
    </Tag>
  ) : (
    <Tooltip title={isContainer ? `Judge ${targetCount} sampled fields` : "Judge this field"}>
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] cursor-pointer ${
          label?.drifted
            ? "border-amber-400 text-amber-600"
            : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
        }`}
      >
        ?
      </span>
    </Tooltip>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="right"
      open={open}
      onOpenChange={onOpenChange}
      destroyTooltipOnHide
    >
      <span className="ml-1 inline-flex align-middle" onClick={(e) => e.stopPropagation()}>
        {chip}
      </span>
    </Popover>
  );
};

export default GoldVerdictControl;
