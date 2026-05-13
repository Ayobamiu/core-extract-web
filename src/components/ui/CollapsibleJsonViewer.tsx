"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { JsonViewer as UnifiedJsonViewer } from "@/components/json";

interface CollapsibleJsonViewerProps {
  data: unknown;
  title: string;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * @deprecated Use `@/components/json` directly. This wrapper exists to keep
 * legacy call sites working while we migrate.
 */
const CollapsibleJsonViewer: React.FC<CollapsibleJsonViewerProps> = ({
  data,
  title,
  defaultOpen = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsOpen((v) => !v);
            }
          }}
        >
          <CardTitle>
            <span>{title}</span>
          </CardTitle>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </motion.div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <CardContent>
              <UnifiedJsonViewer
                value={data}
                readOnly
                bordered={false}
                showStatusBar={false}
                height={360}
                toolbar={["mode", "search", "copy", "download"]}
              />
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default CollapsibleJsonViewer;
