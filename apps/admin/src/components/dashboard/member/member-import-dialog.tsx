"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { Upload as UploadIcon } from "@phosphor-icons/react/dist/ssr/Upload";
import { FileArrowUp as FileIcon } from "@phosphor-icons/react/dist/ssr/FileArrowUp";
import { zodResolver } from "@hookform/resolvers/zod";
import { z as zod } from "zod";
import { useForm } from "react-hook-form";

interface MemberImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function MemberImportDialog({
  open,
  onClose,
  onImport,
  isLoading = false,
  error = null,
}: MemberImportDialogProps): React.JSX.Element {
  const [file, setFile] = React.useState<File | null>(null);
  const [fileContent, setFileContent] = React.useState<any[] | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setFileError(null);
    setFileContent(null);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target?.result as string);
          if (!Array.isArray(content)) {
            setFileError("Invalid file format. Expected an array of members.");
            return;
          }
          setFileContent(content);
        } catch (err) {
          setFileError(
            "Error parsing JSON file. Please check the file format.",
          );
        }
      };
      reader.onerror = () => {
        setFileError("Error reading file. Please try again.");
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (fileContent) {
      await onImport(fileContent);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Members</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {fileError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {fileError}
          </Alert>
        )}
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            p: 3,
            textAlign: "center",
            bgcolor: "background.neutral",
            mb: 2,
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".json"
            onChange={handleFileChange}
          />
          <UploadIcon
            fontSize="var(--icon-fontSize-xl)"
            style={{ marginBottom: 8 }}
          />
          <Typography variant="subtitle1" gutterBottom>
            Drag and drop or click to upload
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Supported format: JSON
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBrowseClick}
            sx={{ mt: 2 }}
          >
            Browse Files
          </Button>
        </Box>

        {file && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1,
              mb: 2,
            }}
          >
            <FileIcon fontSize="var(--icon-fontSize-md)" />
            <Box sx={{ ml: 1, flexGrow: 1 }}>
              <Typography variant="body2" noWrap>
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(2)} KB
              </Typography>
            </Box>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary">
          The JSON file should contain an array of member objects with
          properties such as name, email, phone, and address.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={isLoading || !fileContent}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isLoading ? "Importing..." : "Import Members"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
