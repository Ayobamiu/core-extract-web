"use client";

import React, { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";
import {
  ChevronDownIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

interface ExampleSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  schema: any;
}

const exampleSchemas: ExampleSchema[] = [
  {
    id: "well-drilling",
    name: "Well Drilling Log",
    description:
      "Comprehensive schema for extracting data from oil and gas well drilling logs",
    category: "Oil & Gas",
    schema: {
      type: "object",
      properties: {
        casing: {
          type: "array",
          items: {
            type: "object",
            properties: {
              size: {
                type: ["number", "null"],
                description: "The diameter of the casing, typically in inches.",
              },
              type: {
                enum: ["Surface", "Intermediate", "Production", null],
                description:
                  "The function or designation of the casing string, such as 'Surface', 'Intermediate', or 'Production'.",
              },
              cement_type: {
                type: ["string", "null"],
                description:
                  "The type or specification of cement used for this casing string.",
              },
              bags_of_cement: {
                type: ["number", "null"],
                description:
                  "The number of bags of cement used to secure this casing string.",
              },
              Interval: {
                type: ["number", "null"],
                description:
                  "The length or interval covered by the casing, if specified.",
              },
            },
            additionalProperties: false,
            required: [
              "size",
              "type",
              "cement_type",
              "bags_of_cement",
              "Interval",
            ],
          },
          description:
            "A list of casing strings set in the well. Each entry describes a casing type, size, cement details, and other relevant information.",
        },
        issues: {
          type: ["string", "null"],
          description:
            "Any reported issues, problems, or notes related to the well, such as operational difficulties, regulatory concerns, or special conditions.",
        },
        status: {
          enum: [
            "Active",
            "Drilling Completed",
            "Orphan",
            "Plugged Back",
            "Plugging Approved",
            "Plugging Completed",
            "Producing",
            "Pilot",
            "Permitted Well",
            "Shut In",
            "Suspended",
            "Temporarily Abandoned",
            "Terminated Permit",
            "Well Completed",
            null,
          ],
          description:
            "The current status of the well, such as 'permitted', 'drilled', 'completed', 'plugged', or other operational states. This may be explicitly stated or inferred from context.",
        },
        acidized: {
          type: ["boolean", "null"],
          description:
            "Indicates whether acid treatment was performed on the well to enhance production. True if acidized, false if not, or null if unknown.",
        },
        deviation: {
          enum: ["Deviated", "Horizontal", "Straight", null],
          description:
            "The maximum deviation of the wellbore from vertical, typically measured in degrees or feet/meters. Indicates the extent of directional drilling, if any.",
        },
        elevation: {
          type: ["number", "null"],
          description:
            "The surface elevation at the well location, typically measured in feet or meters above sea level. This value may be labeled as 'Elevation', 'Ground Elevation', or similar.",
        },
        fractured: {
          type: ["boolean", "null"],
          description:
            "Indicates whether hydraulic fracturing or similar stimulation was performed on the well. True if fractured, false if not, or null if unknown.",
        },
        well_type: {
          enum: [
            "Brine Disposal",
            "Dry Hole",
            "Gas Injection",
            "Gas Production",
            "Gas Storage",
            "Mineral",
            "Oil Production",
            "Other Injection",
            "Water Injection",
            "Observation",
            "Location",
            "Lost Hole",
            "LPG",
            "Other",
            null,
          ],
          description:
            "The intended type or purpose of the well, such as 'oil', 'gas', 'test hole', 'injection', or other. This field captures the primary function as described in the document.",
        },
        lease_name: {
          type: ["string", "null"],
          description:
            "The name or designation of the lease under which the well is being drilled. This typically refers to the property or agreement name and may be labeled as 'Lease Name', 'Leased Property', or similar.",
        },
        well_number: {
          type: ["string", "null"],
          description:
            "The specific number or identifier for the well within the lease or field. This may include numbers, letters, or a combination, and is often labeled as 'Well No.', 'Well Number', or similar.",
        },
        permit_number: {
          type: ["string", "null"],
          description:
            "The unique identifier assigned to the drilling permit for this well. This number is used for regulatory tracking and may appear with labels such as 'Permit No.', 'Permit Number', or similar. In these documents, it is often found near the bottom or in a dedicated section.",
        },
        measured_depth: {
          type: ["number", "null"],
          description:
            "The total measured depth of the wellbore, typically in feet or meters. This is the length along the well path from surface to the deepest point drilled.",
        },
        completion_date: {
          type: ["string", "null"],
          "extend:type": "date",
          description:
            "The date when the well was completed, plugged, or otherwise finished. This is typically the date of final operations and may be labeled as 'Completion Date', 'Plugging Date', or similar.",
        },
      },
      required: [
        "casing",
        "issues",
        "status",
        "acidized",
        "deviation",
        "elevation",
        "fractured",
        "well_type",
        "lease_name",
        "well_number",
        "permit_number",
        "measured_depth",
        "completion_date",
      ],
      additionalProperties: false,
    },
  },
  {
    id: "invoice",
    name: "Invoice Document",
    description:
      "Schema for extracting data from invoices and billing documents",
    category: "Finance",
    schema: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The unique invoice number or identifier",
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "The date when the invoice was issued",
        },
        due_date: {
          type: "string",
          format: "date",
          description: "The payment due date",
        },
        vendor: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Vendor or company name",
            },
            address: {
              type: "string",
              description: "Vendor address",
            },
            tax_id: {
              type: "string",
              description: "Vendor tax identification number",
            },
          },
          required: ["name", "address"],
          description: "Vendor information",
        },
        customer: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Customer name",
            },
            address: {
              type: "string",
              description: "Customer billing address",
            },
          },
          required: ["name", "address"],
          description: "Customer information",
        },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Item or service description",
              },
              quantity: {
                type: "number",
                description: "Quantity of items",
              },
              unit_price: {
                type: "number",
                description: "Price per unit",
              },
              total: {
                type: "number",
                description: "Total amount for this line item",
              },
            },
            required: ["description", "quantity", "unit_price", "total"],
          },
          description: "List of items or services billed",
        },
        subtotal: {
          type: "number",
          description: "Subtotal before taxes and fees",
        },
        tax_amount: {
          type: "number",
          description: "Total tax amount",
        },
        total_amount: {
          type: "number",
          description: "Final total amount due",
        },
      },
      required: [
        "invoice_number",
        "invoice_date",
        "vendor",
        "customer",
        "line_items",
        "total_amount",
      ],
      additionalProperties: false,
    },
  },
  {
    id: "contract",
    name: "Contract Agreement",
    description:
      "Schema for extracting key terms and clauses from legal contracts",
    category: "Legal",
    schema: {
      type: "object",
      properties: {
        contract_title: {
          type: "string",
          description: "The title or name of the contract",
        },
        contract_date: {
          type: "string",
          format: "date",
          description: "The date when the contract was signed",
        },
        effective_date: {
          type: "string",
          format: "date",
          description: "The date when the contract becomes effective",
        },
        expiration_date: {
          type: "string",
          format: "date",
          description: "The contract expiration or end date",
        },
        parties: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Party name or company name",
              },
              role: {
                type: "string",
                description:
                  "Role in the contract (e.g., 'Client', 'Contractor', 'Vendor')",
              },
              address: {
                type: "string",
                description: "Party address",
              },
            },
            required: ["name", "role"],
          },
          description: "List of parties involved in the contract",
        },
        contract_value: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Contract value amount",
            },
            currency: {
              type: "string",
              description: "Currency code (e.g., 'USD', 'EUR')",
            },
            payment_terms: {
              type: "string",
              description: "Payment terms and schedule",
            },
          },
          description: "Contract financial terms",
        },
        key_terms: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Important terms and conditions",
        },
        termination_clause: {
          type: "string",
          description: "Contract termination conditions",
        },
      },
      required: [
        "contract_title",
        "contract_date",
        "parties",
        "contract_value",
      ],
      additionalProperties: false,
    },
  },
];

interface ExampleSchemaDropdownProps {
  onSelectSchema: (schema: any) => void;
}

export default function ExampleSchemaDropdown({
  onSelectSchema,
}: ExampleSchemaDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectSchema = (schema: ExampleSchema) => {
    onSelectSchema(schema.schema);
    setIsOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <DocumentTextIcon className="h-4 w-4" />
        See Example
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[28rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Example Schemas</h3>
            <p className="text-sm text-gray-600">
              Choose a template to get started
            </p>
          </div>

          {/* Schema List */}
          <div className="max-h-96 overflow-y-auto">
            {exampleSchemas.map((schema) => (
              <div
                key={schema.id}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                onClick={() => handleSelectSchema(schema)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {schema.name}
                      </h4>
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {schema.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {schema.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(
                            JSON.stringify(schema.schema, null, 2)
                          );
                        }}
                        className="text-xs px-2 py-1 h-6"
                      >
                        <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSchema(schema);
                        }}
                        className="text-xs px-2 py-1 h-6"
                      >
                        Use This
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
