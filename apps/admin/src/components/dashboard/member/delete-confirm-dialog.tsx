'use client';

import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { Warning as WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  itemName?: string;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  error = null,
  title = 'Delete Confirmation',
  description = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName,
}: DeleteConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon
          color="var(--mui-palette-error-main)"
          fontSize="var(--icon-fontSize-lg)"
        />
        {title}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography>
          {itemName
            ? `Are you sure you want to delete ${itemName}? This action cannot be undone.`
            : description}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={isLoading}
          startIcon={
            isLoading ? <CircularProgress size={20} color="inherit" /> : null
          }
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
