"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z as zod } from "zod";

import { Member, isSuperAdmin } from "@/lib/members/client";
import { Role } from "@/types/user";
import { useUser } from "@/hooks/use-user";

// Define the schema for member form validation
const memberSchema = zod.object({
  name: zod.string().min(1, { message: "Name is required" }),
  phone: zod.string().min(1, { message: "Phone number is required" }),
  npub: zod.string().optional().or(zod.literal("")),
  pin: zod
    .string()
    .min(6, { message: "PIN must be at least 6 characters" })
    .optional(),
  roles: zod.array(zod.number()),
});

type MemberFormValues = zod.infer<typeof memberSchema>;

interface MemberFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MemberFormValues) => Promise<void>;
  member?: Member | null;
  isLoading?: boolean;
  error?: string | null;
}

export function MemberForm({
  open,
  onClose,
  onSubmit,
  member = null,
  isLoading = false,
  error = null,
}: MemberFormProps): React.JSX.Element {
  const isEditMode = Boolean(member);
  const { user } = useUser();
  const currentUserIsSuperAdmin = isSuperAdmin(user);

  const defaultValues: MemberFormValues = React.useMemo(
    () => ({
      name: member?.name || "",
      phone: member?.phone || "",
      npub: member?.npub || "",
      pin: "", // PIN is always blank for security
      roles: member?.roles || [Role.Member],
    }),
    [member],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues,
  });

  // Reset the form when the member changes (or dialog opens/closes)
  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
      setFormError(error);
    }
  }, [open, reset, defaultValues, error]);

  const handleFormSubmit = async (data: MemberFormValues) => {
    // Security check: Prevent non-super-admins from setting SuperAdmin role
    if (!currentUserIsSuperAdmin && data.roles.includes(Role.SuperAdmin)) {
      setFormError("You do not have permission to assign the Super Admin role");
      return;
    }

    // For editing mode, if pin is empty, remove it from the data to avoid sending empty pins
    const submissionData = { ...data };
    if (
      isEditMode &&
      (!submissionData.pin || submissionData.pin.trim() === "")
    ) {
      delete submissionData.pin;
    }

    console.log("Submitting form data:", submissionData);
    await onSubmit(submissionData);
  };

  // State for form-level errors
  const [formError, setFormError] = React.useState<string | null>(error);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? "Edit Member" : "Add New Member"}</DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          {(error || formError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError || error}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Name"
                    fullWidth
                    required
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    disabled={isLoading}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Phone Number"
                    fullWidth
                    required
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                    disabled={isLoading}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="npub"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Nostr NPUB"
                    fullWidth
                    error={!!errors.npub}
                    helperText={errors.npub?.message}
                    disabled={isLoading}
                  />
                )}
              />
            </Grid>
            {!isEditMode && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="pin"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="PIN (6+ digits)"
                      type="password"
                      fullWidth
                      required={!isEditMode}
                      error={!!errors.pin}
                      helperText={
                        errors.pin?.message ||
                        "Leave blank to generate random PIN"
                      }
                      disabled={isLoading}
                    />
                  )}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Roles
              </Typography>
              <FormControl fullWidth error={!!errors.roles}>
                <Controller
                  name="roles"
                  control={control}
                  render={({ field }) => (
                    <>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={field.value.includes(Role.Member)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, Role.Member]);
                              } else {
                                field.onChange(
                                  field.value.filter(
                                    (role) => role !== Role.Member,
                                  ),
                                );
                              }
                            }}
                            disabled={isLoading}
                          />
                        }
                        label="Member"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={field.value.includes(Role.Admin)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, Role.Admin]);
                              } else {
                                field.onChange(
                                  field.value.filter(
                                    (role) => role !== Role.Admin,
                                  ),
                                );
                              }
                            }}
                            disabled={isLoading}
                          />
                        }
                        label="Admin"
                      />
                      {currentUserIsSuperAdmin && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={field.value.includes(Role.SuperAdmin)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([
                                    ...field.value,
                                    Role.SuperAdmin,
                                  ]);
                                } else {
                                  field.onChange(
                                    field.value.filter(
                                      (role) => role !== Role.SuperAdmin,
                                    ),
                                  );
                                }
                              }}
                              disabled={isLoading}
                            />
                          }
                          label="Super Admin"
                        />
                      )}
                      {errors.roles && (
                        <FormHelperText error>
                          {errors.roles.message}
                        </FormHelperText>
                      )}
                    </>
                  )}
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Add Member"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
