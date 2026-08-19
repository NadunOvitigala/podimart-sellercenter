import { useRef } from "react";

type FilePickerProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  fileName?: string;
  emptyLabel?: string;
  buttonLabel?: string;
  onFiles: (files: FileList) => void;
};

export function FilePicker({
  accept = "image/jpeg,image/png,image/webp",
  multiple = false,
  disabled = false,
  fileName = "",
  emptyLabel = "No photo chosen",
  buttonLabel = "Choose photo",
  onFiles,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        className="file-input-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        className="btn btn-clay"
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </button>
      <span className="file-name">{fileName || emptyLabel}</span>
    </div>
  );
}
