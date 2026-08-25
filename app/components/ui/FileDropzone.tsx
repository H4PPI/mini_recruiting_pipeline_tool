import type { ChangeEvent } from "react";

interface FileDropzoneProps {
  id: string;
  accept?: string;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}

export default function FileDropzone({
  id,
  accept,
  file,
  disabled = false,
  onChange,
}: FileDropzoneProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] || null);
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        id={id}
        disabled={disabled}
      />
      <label
        htmlFor={id}
        className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-black/20 rounded-lg cursor-pointer hover:border-mainYellow transition-colors"
      >
        <div className="text-center">
          <div className="text-2xl mb-2">PDF</div>
          <p className="font-semibold text-black mb-1">
            {file ? file.name : "Click to upload PDF"}
          </p>
          <p className="text-sm text-black/60">or drag and drop a PDF file</p>
        </div>
      </label>
    </div>
  );
}
