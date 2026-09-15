import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AccessNotAuthorizedPage from "./AccessNotAuthorizedPage.jsx";
import SignInPage from "./SignInPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import ProfileSwitcher from "../components/app/ProfileSwitcher.jsx";

vi.mock("../../app/actions/auth", () => ({
  signInWithGoogle: () => {},
  signOutOperator: () => {},
}));

describe("auth and profile chrome", () => {
  it("renders Google sign-in without a password form", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByText(/social campaign command center/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("renders an access-not-authorized screen", () => {
    render(<AccessNotAuthorizedPage />);
    expect(screen.getByRole("heading", { name: /access not authorized/i })).toBeInTheDocument();
    expect(screen.getByText(/not approved for the regeneluxe private pilot/i)).toBeInTheDocument();
  });

  it("shows the active managed profile identity when only one profile exists", () => {
    render(
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Studio", email: "validsstudio@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <ProfileSwitcher />
      </ProfileSessionProvider>,
    );
    expect(screen.getByText("DJ Coast")).toBeInTheDocument();
    expect(screen.getByText("Active profile")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("becomes a switcher when more than one profile exists", () => {
    render(
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Studio", email: "validsstudio@gmail.com" }}
        profiles={[
          { id: "prf_1", displayName: "DJ Coast" },
          { id: "prf_2", displayName: "Second" },
        ]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <ProfileSwitcher />
      </ProfileSessionProvider>,
    );
    expect(screen.getByRole("combobox", { name: /switch profile/i })).toBeInTheDocument();
  });
});
