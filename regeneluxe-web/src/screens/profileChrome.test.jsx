import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccessNotAuthorizedPage from "./AccessNotAuthorizedPage.jsx";
import SignInPage from "./SignInPage.jsx";
import ProfileSettingsPage from "./ProfileSettingsPage.jsx";
import ProfileSetupPage from "./ProfileSetupPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import OperatorMenu from "../components/app/OperatorMenu.jsx";
import ProfileSwitcher from "../components/app/ProfileSwitcher.jsx";

vi.mock("../../app/actions/auth", () => ({
  signInWithGoogle: () => {},
  signOutOperator: () => {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

function fileOf(bytes, { name = "DJ-Coast.png", type = "image/png" } = {}) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function chooseFile(file) {
  const input = document.getElementById("profile-image");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  fireEvent.change(input);
}

function stubImage({ width = 500, height = 500, fail = false } = {}) {
  class FakeImage {
    set src(_value) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.width = width;
      this.height = height;
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Error("decode"));
        else this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

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
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Studio", email: "validsstudio@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <ProfileSwitcher />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("DJ Coast")).toBeInTheDocument();
    expect(screen.getAllByText("Active profile").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /dj coast/i }));
    expect(screen.getByRole("menuitem", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("becomes a switcher when more than one profile exists", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Studio", email: "validsstudio@gmail.com" }}
          profiles={[
            { id: "prf_1", displayName: "DJ Coast" },
            { id: "prf_2", displayName: "Second" },
          ]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <ProfileSwitcher />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox", { name: /switch profile/i })).toBeInTheDocument();
  });

  it("labels the operator as signed in with Google", () => {
    render(
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Valid", email: "validsstudio@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <OperatorMenu />
      </ProfileSessionProvider>,
    );
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Signed in with Google")).toBeInTheDocument();
    expect(screen.getByText("validsstudio@gmail.com")).toBeInTheDocument();
  });
});

describe("profile setup image and field diagnostics", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    stubImage({ width: 500, height: 500 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("previews a valid 500 × 500 PNG with filename, dimensions, and size", async () => {
    render(<ProfileSetupPage operator={{ name: "Studio" }} />);
    chooseFile(fileOf(411_229));
    expect(await screen.findByText("DJ-Coast.png")).toBeInTheDocument();
    expect(screen.getByText("500 × 500")).toBeInTheDocument();
    expect(screen.getByText("402 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove image/i })).toBeInTheDocument();
    expect(screen.queryByText(/choose an image under/i)).not.toBeInTheDocument();
  });

  it("shows a MIME-specific error for SVG and does not treat it as a size error", async () => {
    render(<ProfileSetupPage />);
    chooseFile(fileOf(80_000, { name: "mark.svg", type: "image/svg+xml" }));
    expect(await screen.findByText("PNG, JPG, or WebP images are supported.")).toBeInTheDocument();
    expect(screen.queryByText(/500 kb/i)).not.toBeInTheDocument();
  });

  it("shows a bad-email error on blur", () => {
    render(<ProfileSetupPage />);
    const email = screen.getByLabelText(/primary email/i);
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("shows a URL error on blur and does not error a blank website", () => {
    render(<ProfileSetupPage />);
    const publicLink = screen.getByLabelText(/primary public link/i);
    fireEvent.change(publicLink, { target: { value: "youtube.com/@x" } });
    fireEvent.blur(publicLink);
    fireEvent.blur(screen.getByLabelText(/^website$/i));
    expect(screen.getByText("Enter a complete URL beginning with http:// or https://.")).toBeInTheDocument();
  });

  it("focuses the first invalid field on save", () => {
    render(<ProfileSetupPage />);
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    expect(screen.getByText("Please fix 5 fields before saving.")).toBeInTheDocument();
    expect(screen.getByLabelText(/profile name/i)).toHaveFocus();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("clears a field error as soon as the value is corrected", () => {
    render(<ProfileSetupPage />);
    const name = screen.getByLabelText(/profile name/i);
    fireEvent.blur(name);
    expect(screen.getByText("Enter a profile name.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "DJ Coast" } });
    expect(screen.queryByText("Enter a profile name.")).not.toBeInTheDocument();
  });

  it("does not flash an error on an untouched optional website", () => {
    render(<ProfileSetupPage />);
    expect(screen.queryByText(/enter a complete url/i)).not.toBeInTheDocument();
  });
});

describe("profile settings edit", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    stubImage({ width: 500, height: 500 });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, profile: { id: "prf_1", displayName: "DJ Coast" } }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const profile = {
    id: "prf_1",
    displayName: "DJ Coast",
    slug: "dj-coast",
    primaryEmail: "djcoast239@gmail.com",
    primaryPublicUrl: "https://www.youtube.com/@CoastEntertainment",
    website: "",
    platforms: ["YouTube"],
    status: "ACTIVE",
    avatarUrl: "/api/media/med_1",
  };

  it("edits the active profile without first-run onboarding copy", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Valid", email: "validsstudio@gmail.com" }}
          profiles={[profile]}
          activeProfile={profile}
        >
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/profile name/i)).toHaveValue("DJ Coast");
    expect(screen.getByRole("button", { name: /change image/i })).toBeInTheDocument();
    expect(screen.queryByText(/create the first managed profile/i)).not.toBeInTheDocument();
  });

  it("replaces a profile image through the validated picker", async () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider profiles={[profile]} activeProfile={profile}>
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    chooseFile(fileOf(411_229));
    expect(await screen.findByText("DJ-Coast.png")).toBeInTheDocument();
    expect(screen.getByText("500 × 500")).toBeInTheDocument();
  });

  it("removes the current profile image", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider profiles={[profile]} activeProfile={profile}>
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove image/i }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /change image/i }).length).toBeGreaterThan(0);
  });
});
