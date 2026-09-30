import type { AppContent } from "../app-types";

export const app: AppContent = {
  login: {
    title: "Sign in",
    subtitle: "Get a sign-in link by email. No password needed.",
    email: "Email",
    sendLink: "Send sign-in link",
    sending: "Sending…",
    linkSent: "Sent! Check your inbox and click the link to sign in.",
    or: "or",
    google: "Continue with Google",
    errors: { invalid_email: "Please enter a valid email.", error: "Could not send the link. Please try again." },
  },
  dashboard: {
    nav: { overview: "Overview", account: "Account", notes: "Notes" },
    signOut: "Sign out",
    welcome: "Welcome",
    overviewText: "This is the sample dashboard. The product area lives under Notes.",
  },
  account: {
    title: "Account",
    profile: "Profile",
    exportTitle: "Export data",
    exportText: "Download all your data as JSON.",
    exportButton: "Download",
    deleteTitle: "Delete account",
    deleteText: "Permanently delete your account and all data. This cannot be undone.",
    deleteConfirmLabel: "Type your email to confirm",
    deleteButton: "Delete account",
  },
  notes: {
    title: "Notes",
    empty: "No notes yet.",
    titleLabel: "Title",
    bodyLabel: "Body",
    create: "Add note",
    save: "Save",
    delete: "Delete",
    back: "Back",
    errors: { required: "Please enter a title.", too_long: "This is too long.", error: "Something went wrong. Please try again." },
  },
  legal: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    lastUpdated: "Last updated",
    templateNotice: "This is a template. Replace it with legal text appropriate for your business.",
  },
};
