"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SchemaProperty } from "./SchemaBuilder";
import { HybridSchemaBuilder } from "./HybridSchemaBuilder";
import { FileUploadStep, UploadedFile } from "./FileUploadStep";
import { apiClient } from "../../lib/api";

type JobCreationStep = "schema" | "upload";

interface GeneratedSchema {
  properties: Array<{
    key: string;
    type: string;
    description: string;
    examples?: string[];
  }>;
  confidence: number;
  reasoning: string;
}

interface JobCreationData {
  jobName: string;
  schemaName: string;
  schema: SchemaProperty[];
  files: UploadedFile[];
}

export function JobCreationFlow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<JobCreationStep>("schema");
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobData, setJobData] = useState<JobCreationData>({
    jobName: "",
    schemaName: "",
    schema: [],
    files: [],
  });

  const handleSchemaChange = useCallback((schema: SchemaProperty[]) => {
    setJobData((prev) => ({
      ...prev,
      schema,
    }));
  }, []);

  const handleJobNameChange = useCallback((jobName: string) => {
    setJobData((prev) => ({ ...prev, jobName }));
  }, []);

  const handleSchemaNameChange = useCallback((schemaName: string) => {
    setJobData((prev) => ({ ...prev, schemaName }));
  }, []);

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setJobData((prev) => ({ ...prev, files }));
  }, []);

  const validateSchema = useCallback((schema: SchemaProperty[]): string[] => {
    const errors: string[] = [];

    if (schema.length === 0) {
      errors.push("Schema must have at least one property");
    }

    const keys = new Set<string>();
    schema.forEach((prop, index) => {
      if (!prop.key.trim()) {
        errors.push(`Property ${index + 1}: Key is required`);
      } else if (keys.has(prop.key)) {
        errors.push(`Property ${index + 1}: Duplicate key "${prop.key}"`);
      } else {
        keys.add(prop.key);
      }

      if (!prop.description.trim()) {
        errors.push(`Property ${index + 1}: Description is required`);
      }
    });

    return errors;
  }, []);

  const convertSchemaToJSON = useCallback((schema: SchemaProperty[]): any => {
    const result: any = {};

    schema.forEach((prop) => {
      switch (prop.type) {
        case "text":
          result[prop.key] = {
            type: "string",
            description: prop.description,
          };
          break;
        case "number":
          result[prop.key] = {
            type: "number",
            description: prop.description,
          };
          break;
        case "boolean":
          result[prop.key] = {
            type: "boolean",
            description: prop.description,
          };
          break;
        case "date":
          result[prop.key] = {
            type: "string",
            format: "date-time",
            description: prop.description,
          };
          break;
        case "enum":
          result[prop.key] = {
            type: "string",
            enum: prop.enumValues || [],
            description: prop.description,
          };
          break;
        case "array":
          result[prop.key] = {
            type: "array",
            items: { type: "string" },
            description: prop.description,
          };
          break;
        case "object":
          result[prop.key] = {
            type: "object",
            properties: {},
            description: prop.description,
          };
          break;
        default:
          result[prop.key] = {
            type: "string",
            description: prop.description,
          };
      }
    });

    return result;
  }, []);

  const handleSchemaNext = useCallback(() => {
    const errors = validateSchema(jobData.schema);
    if (errors.length > 0) {
      alert(`Please fix the following errors:\n${errors.join("\n")}`);
      return;
    }

    if (jobData.schema.length === 0) {
      alert("Please add at least one property to your schema");
      return;
    }

    setCurrentStep("upload");
  }, [jobData.schema, validateSchema]);

  const handleUploadNext = useCallback(async () => {
    if (jobData.files.length === 0) {
      alert("Please select at least one file to upload");
      return;
    }

    setIsProcessing(true);

    try {
      if (jobData.schema.length === 0) {
        throw new Error("No schema available");
      }

      // Convert schema to JSON format expected by the API
      const schemaJSON = convertSchemaToJSON(jobData.schema);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("schema", JSON.stringify(schemaJSON));
      formData.append("schemaName", jobData.schemaName);
      formData.append(
        "jobName",
        jobData.jobName ||
          `AI Generated Job - ${new Date().toLocaleDateString()}`
      );

      // Add files to FormData
      jobData.files.forEach((file) => {
        formData.append("files", file.file);
      });

      // Submit to API
      const response = await apiClient.extractMultiple(formData);

      if (response.jobId) {
        // Redirect to job detail page
        router.push(`/jobs/${response.jobId}`);
      } else {
        throw new Error("No job ID returned from server");
      }
    } catch (error) {
      console.error("Error creating job:", error);
      alert(
        `Failed to create job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    jobData.files,
    jobData.schema,
    jobData.schemaName,
    jobData.jobName,
    convertSchemaToJSON,
    router,
  ]);

  const handleBack = useCallback(() => {
    if (currentStep === "upload") {
      setCurrentStep("schema");
    } else {
      router.push("/");
    }
  }, [currentStep, router]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Creating Job...
          </h2>
          <p className="text-gray-600">
            Please wait while we process your files
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentStep === "schema" ? (
        <HybridSchemaBuilder
          schema={jobData.schema}
          onSchemaChange={handleSchemaChange}
          onNext={handleSchemaNext}
          onBack={handleBack}
          jobName={jobData.jobName}
          schemaName={jobData.schemaName}
          onJobNameChange={handleJobNameChange}
          onSchemaNameChange={handleSchemaNameChange}
        />
      ) : (
        <FileUploadStep
          files={jobData.files}
          onFilesChange={handleFilesChange}
          onNext={handleUploadNext}
          onBack={handleBack}
          jobName={
            jobData.jobName ||
            `AI Generated Job - ${new Date().toLocaleDateString()}`
          }
          schemaName={jobData.schemaName}
        />
      )}
    </div>
  );
}
