import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Core Extract — Try it on your log",
  description:
    "Upload a boring log or well record. See structured data in about a minute. No signup.",
};

export default function TryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-white text-neutral-900"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
