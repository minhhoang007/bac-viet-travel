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
    errors: { invalid_email: string; error: string };
  };
  dashboard: {
    nav: { overview: string; account: string; notes: string };
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
  notes: {
    title: string;
    empty: string;
    titleLabel: string;
    bodyLabel: string;
    create: string;
    save: string;
    delete: string;
    back: string;
    errors: { required: string; too_long: string; error: string };
  };
  legal: { terms: string; privacy: string; lastUpdated: string; templateNotice: string };
}
