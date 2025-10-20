// Test component to demonstrate permit number matching
import React from "react";
import { checkPermitNumberMatch } from "@/lib/constraintUtils";
import { JobFile } from "@/lib/api";

// Mock file data for testing
const testFiles: JobFile[] = [];

export default function PermitNumberTest() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Permit Number Matching Test</h2>
      <div className="space-y-4">
        {testFiles.map((file) => {
          const result = checkPermitNumberMatch(file);
          return (
            <div key={file.id} className="border p-4 rounded">
              <div className="font-semibold">{file.filename}</div>
              <div className="text-sm text-gray-600">
                Extracted: {JSON.stringify(file.result)}
              </div>
              <div
                className={`text-sm ${
                  result.hasViolation ? "text-red-600" : "text-green-600"
                }`}
              >
                {result.hasViolation ? "⚠️ MISMATCH" : "✅ MATCH"}
              </div>
              <div className="text-xs text-gray-500">
                Filename: {result.filenamePermit || "N/A"} | Data:{" "}
                {result.dataPermit || "N/A"}
              </div>
              <div className="text-xs text-gray-400">{result.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
