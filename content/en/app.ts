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
    errors: {
      invalid_email: "Please enter a valid email.",
      rate_limited: "Too many requests. Please try again in a few minutes.",
      error: "Could not send the link. Please try again.",
      link: "This sign-in link is invalid or has expired. Please request a new one.",
    },
  },
  dashboard: {
    nav: { overview: "Overview", account: "Account" },
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
  legal: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    lastUpdated: "Last updated",
    templateNotice: "This is a template. Replace it with legal text appropriate for your business.",
  },
};
