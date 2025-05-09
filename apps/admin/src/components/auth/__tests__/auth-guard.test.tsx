import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "../auth-guard";
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

describe("AuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    (authClient.signOut as jest.Mock).mockResolvedValue({});
  });

  it("renders children when user has admin role", async () => {
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
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });

  it("renders children when user has super admin role", async () => {
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
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });

  it("redirects to sign in page when user is not logged in", async () => {
    // Mock no user
    (useUser as jest.Mock).mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/auth/sign-in");
    });
  });

  it("shows error and redirects when user does not have admin role", async () => {
    // Mock user with only member role
    (useUser as jest.Mock).mockReturnValue({
      user: {
        id: "123",
        roles: [Role.Member],
      },
      error: null,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("You don't have permission to access this dashboard"),
      ).toBeInTheDocument();
      expect(authClient.signOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/auth/sign-in");
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
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication failed")).toBeInTheDocument();
    });
  });
});
