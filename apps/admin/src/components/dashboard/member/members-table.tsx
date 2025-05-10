"use client";

import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import { Pencil as PencilIcon } from "@phosphor-icons/react/dist/ssr/Pencil";
import { DotsThree as DotsThreeIcon } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { Trash as TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash";
import { CopySimple as CopyIcon } from "@phosphor-icons/react/dist/ssr/CopySimple";
import dayjs from "dayjs";

import { useSelection } from "@/hooks/use-selection";
import { Member, isSuperAdmin } from "@/lib/members/client";
import { useUser } from "@/hooks/use-user";

interface MembersTableProps {
  count: number;
  page: number;
  rows: Member[];
  rowsPerPage: number;
  isLoading?: boolean;
  error?: string | null;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  onEdit?: (member: Member) => void;
  onDelete?: (member: Member) => void;
  onCopyId?: (id: string) => void; // Optional callback for copying ID
}

export function MembersTable({
  count = 0,
  rows = [],
  page = 0,
  rowsPerPage = 5,
  isLoading = false,
  error = null,
  onPageChange,
  onRowsPerPageChange,
  onEdit,
  onDelete,
  onCopyId,
}: MembersTableProps): React.JSX.Element {
  const rowIds = React.useMemo(() => {
    return rows.map((member) => member.id);
  }, [rows]);

  const { selectAll, deselectAll, selectOne, deselectOne, selected } =
    useSelection(rowIds);

  const selectedSome =
    (selected?.size ?? 0) > 0 && (selected?.size ?? 0) < rows.length;
  const selectedAll = rows.length > 0 && selected?.size === rows.length;

  const handlePageChange = (
    _: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    onPageChange(newPage);
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onRowsPerPageChange(parseInt(event.target.value, 10));
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [activeRow, setActiveRow] = React.useState<Member | null>(null);

  // Check if current user is super admin
  const { user } = useUser();
  const currentUserIsSuperAdmin = isSuperAdmin(user);

  const handleOpenMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    row: Member,
  ) => {
    setAnchorEl(event.currentTarget);
    setActiveRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveRow(null);
  };

  const handleEdit = () => {
    if (activeRow && onEdit) {
      onEdit(activeRow);
    }
    handleCloseMenu();
  };

  const handleDelete = () => {
    if (activeRow && onDelete) {
      onDelete(activeRow);
    }
    handleCloseMenu();
  };

  const handleCopyId = () => {
    if (activeRow && activeRow.id) {
      navigator.clipboard
        .writeText(activeRow.id)
        .then(() => {
          // Call the optional callback if provided
          if (onCopyId) {
            onCopyId(activeRow.id);
          }
          console.log("Member ID copied to clipboard");
        })
        .catch((err) => {
          console.error("Failed to copy ID:", err);
        });
    }
    handleCloseMenu();
  };

  return (
    <Card>
      <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: "800px" }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedAll}
                  indeterminate={selectedSome}
                  onChange={(event) => {
                    if (event.target.checked) {
                      selectAll();
                    } else {
                      deselectAll();
                    }
                  }}
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Date Registered</TableCell>
              <TableCell>Date Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography color="error">{error}</Typography>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">
                    No members found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSelected = selected?.has(row.id);

                return (
                  <TableRow hover key={row.id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            selectOne(row.id);
                          } else {
                            deselectOne(row.id);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack
                        sx={{ alignItems: "center" }}
                        direction="row"
                        spacing={2}
                      >
                        <Avatar src={row.avatar} alt={row.name}>
                          {row.name?.charAt(0) || "?"}
                        </Avatar>
                        <Typography variant="subtitle2">{row.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
                    <TableCell>
                      {row.roles && row.roles.length > 0
                        ? row.roles
                            .map((role) => {
                              switch (role) {
                                case 0:
                                  return "Member";
                                case 1:
                                  return "Admin";
                                case 3:
                                  return "Super Admin";
                                default:
                                  return `Role ${role}`;
                              }
                            })
                            .join(", ")
                        : "Member"}
                    </TableCell>
                    <TableCell>
                      {row.createdAt
                        ? dayjs(row.createdAt).format("MMM D, YYYY")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {row.updatedAt
                        ? dayjs(row.updatedAt).format("MMM D, YYYY")
                        : "-"}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="inherit"
                        onClick={(e) => onEdit && onEdit(row)}
                      >
                        <PencilIcon fontSize="var(--icon-fontSize-md)" />
                      </IconButton>
                      <IconButton
                        color="inherit"
                        onClick={(e) => handleOpenMenu(e, row)}
                      >
                        <DotsThreeIcon fontSize="var(--icon-fontSize-md)" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Box>
      <Divider />
      <TablePagination
        component="div"
        count={count}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />

      <Menu
        id="row-actions-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleCopyId}>
          <CopyIcon
            fontSize="var(--icon-fontSize-md)"
            style={{ marginRight: 8 }}
          />
          Copy ID
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <PencilIcon
            fontSize="var(--icon-fontSize-md)"
            style={{ marginRight: 8 }}
          />
          Edit
        </MenuItem>
        {currentUserIsSuperAdmin && (
          <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
            <TrashIcon
              fontSize="var(--icon-fontSize-md)"
              style={{ marginRight: 8 }}
            />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}
