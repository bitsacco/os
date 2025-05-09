import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { GuestGuard } from "../guest-guard";
import { useUser } from "@/hooks/use-user";
import { Role } from "@/types/user";
import { authClient } from "@/lib/auth/client";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/hooks/use-user", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: jest.fn(),
  },
}));

const mockReplace = jest.fn();

describe("GuestGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    (authClient.signOut as jest.Mock).mockResolvedValue({});
  });

  it("renders children when no user is logged in", async () => {
    // Mock no user
    (useUser as jest.Mock).mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
    });

    render(
      <GuestGuard>
        <div data-testid="guest-content">Guest Content</div>
      </GuestGuard>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("guest-content")).toBeInTheDocument();
    });
  });

  it("redirects to dashboard when user with admin role is logged in", async () => {
    // Mock user with admin role
    (useUser as jest.Mock).mockReturnValue({
      user: {
        id: "123",
        roles: [Role.Admin],
      },
      error: null,
      isLoading: false,
    });

    render(
      <GuestGuard>
        <div data-testid="guest-content">Guest Content</div>
      </GuestGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to dashboard when user with super admin role is logged in", async () => {
    // Mock user with super admin role
    (useUser as jest.Mock).mockReturnValue({
      user: {
        id: "123",
        roles: [Role.SuperAdmin],
      },
      error: null,
      isLoading: false,
    });

    render(
      <GuestGuard>
        <div data-testid="guest-content">Guest Content</div>
      </GuestGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error and signs out when user with only member role is logged in", async () => {
    // Mock user with member role only
    (useUser as jest.Mock).mockReturnValue({
      user: {
        id: "123",
        roles: [Role.Member],
      },
      error: null,
      isLoading: false,
    });

    render(
      <GuestGuard>
        <div data-testid="guest-content">Guest Content</div>
      </GuestGuard>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("You don't have permission to access this dashboard"),
      ).toBeInTheDocument();
      expect(authClient.signOut).toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it("shows error when authentication fails", async () => {
    // Mock authentication error
    (useUser as jest.Mock).mockReturnValue({
      user: null,
      error: "Authentication failed",
      isLoading: false,
    });

    render(
      <GuestGuard>
        <div data-testid="guest-content">Guest Content</div>
      </GuestGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication failed")).toBeInTheDocument();
    });
  });
});
