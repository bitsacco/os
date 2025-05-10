"use client";

import * as React from "react";
// Client component - metadata is defined in metadata.ts
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { Download as DownloadIcon } from "@phosphor-icons/react/dist/ssr/Download";
import { Plus as PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { Upload as UploadIcon } from "@phosphor-icons/react/dist/ssr/Upload";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

import { config } from "@/config";
import { useMembers } from "@/hooks/use-members";
import { membersClient, Member, isSuperAdmin } from "@/lib/members/client";
import { MembersFilters } from "@/components/dashboard/member/members-filters";
import { MembersTable } from "@/components/dashboard/member/members-table";
import { MemberForm } from "@/components/dashboard/member/member-form";
import { MemberImportDialog } from "@/components/dashboard/member/member-import-dialog";
import { DeleteConfirmDialog } from "@/components/dashboard/member/delete-confirm-dialog";
import { logger } from "@/lib/default-logger";
import { useUser } from "@/hooks/use-user";
import { Role } from "@/types/user";

// Simple loading component
function LoadingState() {
  return (
    <Stack
      spacing={3}
      alignItems="center"
      justifyContent="center"
      sx={{ py: 8 }}
    >
      <CircularProgress />
      <Typography>Loading membership data...</Typography>
    </Stack>
  );
}

// ErrorState component
function ErrorState({ message }: { message: string }) {
  return (
    <Stack
      spacing={3}
      alignItems="center"
      justifyContent="center"
      sx={{ py: 8 }}
    >
      <Alert severity="error" sx={{ width: "100%", maxWidth: 500 }}>
        {message}
      </Alert>
    </Stack>
  );
}

// Wrapper to handle user context safely
function MembershipPageContent() {
  // Use the context hook directly in the component body (not in useEffect)
  const { user, isLoading, error } = useUser();

  // Check for errors and loading state
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  // Check if user exists
  if (!user) {
    return <ErrorState message="User information not available" />;
  }

  const isAdmin = isSuperAdmin(user);

  // Members state management with custom hook
  const {
    members,
    totalCount,
    isLoading: isLoadingMembers,
    error: membersError,
    refetch,
    search,
    filterByRole,
    setPage,
    setLimit,
    setSort,
  } = useMembers();

  // UI state
  const [page, setPageLocal] = React.useState(0);
  const [rowsPerPage, setRowsPerPageLocal] = React.useState(10);

  // Dialog state
  const [memberFormOpen, setMemberFormOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(
    null,
  );
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(
    null,
  );

  // Operation state
  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [importLoading, setImportLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Notification state
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Handle copying member ID
  const handleCopyMemberId = (id: string) => {
    setNotification({
      open: true,
      message: "Member ID copied to clipboard",
      severity: "success",
    });
  };

  // Handlers for pagination
  const handlePageChange = (newPage: number) => {
    setPageLocal(newPage);
    setPage(newPage);
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPageLocal(newRowsPerPage);
    setLimit(newRowsPerPage);
  };

  // Handlers for search, filter, and sort
  const handleSearch = (term: string) => {
    search(term);
  };

  const handleSort = (field: string, order: "asc" | "desc") => {
    setSort(field, order);
  };

  const handleRoleFilter = (role: Role | null) => {
    filterByRole(role);
  };

  // Member form handlers
  const handleAddMember = () => {
    setSelectedMember(null);
    setFormError(null);
    setMemberFormOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setFormError(null);
    setMemberFormOpen(true);
  };

  const handleMemberFormClose = () => {
    setMemberFormOpen(false);
  };

  const handleMemberFormSubmit = async (data: any) => {
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (selectedMember) {
        // Update existing member
        const result = await membersClient.updateMember(
          selectedMember.id,
          data,
        );
        if (result.error) {
          setFormError(result.error);
          return;
        }

        setNotification({
          open: true,
          message: "Member updated successfully",
          severity: "success",
        });
      } else {
        // Create new member
        const result = await membersClient.createMember(data);
        if (result.error) {
          setFormError(result.error);
          return;
        }

        setNotification({
          open: true,
          message: "Member added successfully",
          severity: "success",
        });
      }

      setMemberFormOpen(false);
      refetch();
    } catch (err) {
      logger.error("Member form submission error:", err);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete member handlers
  const handleDeleteClick = (member: Member) => {
    // Only allow super admins to delete members
    if (!isAdmin) {
      setNotification({
        open: true,
        message: "Only Super Admins can delete members",
        severity: "error",
      });
      return;
    }

    setMemberToDelete(member);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // The users API doesn't support direct deletion
      // Instead, we'll show a message indicating this limitation
      setDeleteError(
        "Delete operation is not supported by the API. You would need to implement soft deletion by updating the user status or a similar approach.",
      );

      // Don't close the dialog so user can see the message
    } catch (err) {
      logger.error("Delete member error:", err);
      setDeleteError("An unexpected error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Import/Export handlers
  const handleImportClick = () => {
    setImportError(null);
    setImportDialogOpen(true);
  };

  const handleImportClose = () => {
    setImportDialogOpen(false);
  };

  const handleImport = async (data: any[]) => {
    setImportLoading(true);
    setImportError(null);

    try {
      const result = await membersClient.bulkImport(data);
      if (result.error) {
        setImportError(result.error);
        return;
      }

      setNotification({
        open: true,
        message: `${data.length} members imported successfully`,
        severity: "success",
      });

      setImportDialogOpen(false);
      refetch();
    } catch (err) {
      logger.error("Import members error:", err);
      setImportError("An unexpected error occurred. Please try again.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = () => {
    if (members.length === 0) {
      setNotification({
        open: true,
        message: "No members to export",
        severity: "info",
      });
      return;
    }

    try {
      const exportData = membersClient.createExportData(members);
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `members-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      setNotification({
        open: true,
        message: `${members.length} members exported successfully`,
        severity: "success",
      });
    } catch (err) {
      logger.error("Export members error:", err);
      setNotification({
        open: true,
        message: "Failed to export members",
        severity: "error",
      });
    }
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={3}>
        <Stack spacing={1} sx={{ flex: "1 1 auto" }}>
          <Typography variant="h4">Members</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button
              color="inherit"
              startIcon={<UploadIcon fontSize="var(--icon-fontSize-md)" />}
              onClick={handleImportClick}
            >
              Import
            </Button>
            <Button
              color="inherit"
              startIcon={<DownloadIcon fontSize="var(--icon-fontSize-md)" />}
              onClick={handleExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
        <div>
          <Button
            startIcon={<PlusIcon fontSize="var(--icon-fontSize-md)" />}
            variant="contained"
            onClick={handleAddMember}
          >
            Add
          </Button>
        </div>
      </Stack>

      <MembersFilters
        onSearch={handleSearch}
        onSort={handleSort}
        onFilterRole={handleRoleFilter}
      />

      <MembersTable
        count={totalCount}
        page={page}
        rows={members}
        rowsPerPage={rowsPerPage}
        isLoading={isLoadingMembers}
        error={membersError}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        onEdit={handleEditMember}
        onDelete={handleDeleteClick}
        onCopyId={handleCopyMemberId}
      />

      {/* Member Add/Edit Form */}
      <MemberForm
        open={memberFormOpen}
        onClose={handleMemberFormClose}
        onSubmit={handleMemberFormSubmit}
        member={selectedMember}
        isLoading={formSubmitting}
        error={formError}
      />

      {/* Import Dialog */}
      <MemberImportDialog
        open={importDialogOpen}
        onClose={handleImportClose}
        onImport={handleImport}
        isLoading={importLoading}
        error={importError}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteLoading}
        error={deleteError}
        title="Delete Member"
        description="Are you sure you want to delete this member? This action cannot be undone."
        itemName={memberToDelete?.name}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

// Main page component
export default function Page(): React.JSX.Element {
  return (
    <>
      <MembershipPageContent />
    </>
  );
}
