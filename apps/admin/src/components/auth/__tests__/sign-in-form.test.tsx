import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInForm } from "../sign-in-form";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/hooks/use-user";
import { Role } from "@/types/user";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => {
  return jest.fn(({ children }) => children);
});

jest.mock("@/hooks/use-user", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

const mockRefresh = jest.fn();
const mockCheckSession = jest.fn();

describe("SignInForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      refresh: mockRefresh,
    });

    (useUser as jest.Mock).mockReturnValue({
      checkSession: mockCheckSession,
    });

    (authClient.signIn as jest.Mock).mockResolvedValue({});
    (authClient.signOut as jest.Mock).mockResolvedValue({});
  });

  it("allows admin user to sign in successfully", async () => {
    // Mock successful login with admin role
    (authClient.signIn as jest.Mock).mockResolvedValue({
      data: {
        id: "123",
        roles: [Role.Admin],
      },
      error: null,
    });

    render(<SignInForm />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), {
      target: { value: "+254712345678" },
    });

    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: "123456" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn).toHaveBeenCalledWith({
        phone: "+254712345678",
        pin: "123456",
      });
      expect(mockCheckSession).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("allows super admin user to sign in successfully", async () => {
    // Mock successful login with super admin role
    (authClient.signIn as jest.Mock).mockResolvedValue({
      data: {
        id: "123",
        roles: [Role.SuperAdmin],
      },
      error: null,
    });

    render(<SignInForm />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), {
      target: { value: "+254712345678" },
    });

    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: "123456" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn).toHaveBeenCalledWith({
        phone: "+254712345678",
        pin: "123456",
      });
      expect(mockCheckSession).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("prevents member-only user from signing in", async () => {
    // Mock successful login but with member role only
    (authClient.signIn as jest.Mock).mockResolvedValue({
      data: {
        id: "123",
        roles: [Role.Member],
      },
      error: null,
    });

    render(<SignInForm />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), {
      target: { value: "+254712345678" },
    });

    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: "123456" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn).toHaveBeenCalledWith({
        phone: "+254712345678",
        pin: "123456",
      });
      expect(
        screen.getByText(/You don't have permission to access this dashboard/i),
      ).toBeInTheDocument();
      expect(authClient.signOut).toHaveBeenCalled();
      expect(mockCheckSession).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("shows error on failed sign in", async () => {
    // Mock failed login
    (authClient.signIn as jest.Mock).mockResolvedValue({
      data: null,
      error: "Invalid credentials",
    });

    render(<SignInForm />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), {
      target: { value: "+254712345678" },
    });

    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: "123456" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn).toHaveBeenCalledWith({
        phone: "+254712345678",
        pin: "123456",
      });
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});
