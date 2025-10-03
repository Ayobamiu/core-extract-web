"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import JsonView from "@uiw/react-json-view";

interface CollapsibleJsonViewerProps {
  data: any;
  title: string;
  defaultOpen?: boolean;
  className?: string;
}

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
        <CardTitle
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{title}</span>
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
        </CardTitle>
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
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto">
                <JsonView
                  value={data}
                  style={{
                    backgroundColor: "transparent",
                    fontSize: "14px",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  }}
                  displayDataTypes={false}
                  displayObjectSize={false}
                  enableClipboard={true}
                  collapsed={false}
                  theme="light"
                />
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default CollapsibleJsonViewer;
