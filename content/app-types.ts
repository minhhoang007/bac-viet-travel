export interface AppContent {
  login: {
    title: string;
    subtitle: string;
    email: string;
    sendLink: string;
    sending: string;
    linkSent: string;
    or: string;
    google: string;
    errors: { invalid_email: string; rate_limited: string; error: string; link: string };
  };
  dashboard: {
    nav: { overview: string; account: string };
    signOut: string;
    welcome: string;
    overviewText: string;
  };
  account: {
    title: string;
    profile: string;
    exportTitle: string;
    exportText: string;
    exportButton: string;
    deleteTitle: string;
    deleteText: string;
    deleteConfirmLabel: string;
    deleteButton: string;
  };
  legal: { terms: string; privacy: string; lastUpdated: string; templateNotice: string };
  billing: {
    title: string;
    currentPlan: string;
    activeUntil: string;
    renewsAutomatically: string;
    upgradeTitle: string;
    monthly: string;
    yearly: string;
    payInternational: string;
    payVietnam: string;
    vietnamNote: string;
    manage: string;
    pricingTitle: string;
    pricingSubtitle: string;
    perMonth: string;
    perYear: string;
    choosePlan: string;
    returnPaid: string;
    returnPending: string;
    returnFailed: string;
    returnInvalid: string;
    backToBilling: string;
    checkoutSuccess: string;
    error: string;
  };
}
