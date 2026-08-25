"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import Field from "@/app/components/ui/Field";
import FileDropzone from "@/app/components/ui/FileDropzone";
import TabButton from "@/app/components/ui/TabButton";
import TextArea from "@/app/components/ui/TextArea";
import TextField from "@/app/components/ui/TextField";
import type { Job } from "@/app/types/jobs";

interface JobFormProps {
  onJobAdded: (job: Job) => void;
  onCancel: () => void;
  editingJob?: Job;
  onJobUpdated?: (job: Job) => void;
}

export default function JobForm({
  onJobAdded,
  onCancel,
  editingJob,
  onJobUpdated,
}: JobFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(editingJob?.title || "");
  const [description, setDescription] = useState(editingJob?.description || "");
  const [jdText, setJdText] = useState(editingJob?.jdText || "");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"text" | "file">(
    editingJob?.jdBlobPath && !editingJob.jdText ? "file" : "text"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Job title is required");
      return;
    }

    if (activeTab === "text" && !jdText.trim()) {
      setError("Please provide a job description (text or PDF)");
      return;
    }

    if (activeTab === "file" && !jdFile) {
      setError("Please upload a PDF job description");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      if (activeTab === "text") {
        formData.append("jdText", jdText);
      }
      if (activeTab === "file" && jdFile) {
        formData.append("jdFile", jdFile);
      }

      const url = editingJob ? `/api/jobs/${editingJob.id}` : "/api/jobs";
      const method = editingJob ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save job");
      }

      const newJob = await response.json();

      if (editingJob && onJobUpdated) {
        onJobUpdated(newJob);
      } else {
        onJobAdded(newJob);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-black/10 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-black mb-6">
        {editingJob ? "Edit Job" : "Add New Job"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Field label="Job Title" required>
          <TextField
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Senior Software Engineer"
            disabled={loading}
          />
        </Field>

        <Field label="Description">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the job..."
            rows={3}
            disabled={loading}
          />
        </Field>

        {/* Job Description Upload */}
        <div>
          <label className="block text-sm font-semibold text-black mb-4">
            Job Description (JD) *
          </label>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-black/10">
            <TabButton
              onClick={() => setActiveTab("text")}
              active={activeTab === "text"}
            >
              Paste Text
            </TabButton>
            <TabButton
              onClick={() => setActiveTab("file")}
              active={activeTab === "file"}
            >
              Upload PDF
            </TabButton>
          </div>

          {/* Text Tab */}
          {activeTab === "text" && (
            <TextArea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description here..."
              className="py-3 font-mono text-sm"
              rows={8}
              disabled={loading}
            />
          )}

          {/* File Tab */}
          {activeTab === "file" && (
            <FileDropzone
              id="jd-file-input"
              accept=".pdf"
              file={jdFile}
              onChange={setJdFile}
              disabled={loading}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-black/10">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : editingJob
              ? "Update Job"
              : "Create Job"}
          </Button>
        </div>
      </form>
    </div>
  );
}
