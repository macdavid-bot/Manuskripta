import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import CreateBookPage from "@/pages/create-book";
import FormatBookPage from "@/pages/format-book";
import BookDetailsPage from "@/pages/book-details";
import ReaderPage from "@/pages/reader";
import AdminPage from "@/pages/admin";
import AnnouncementsPage from "@/pages/announcements";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function OfflineBanner() {
  const { isOffline } = useApp();
  if (!isOffline) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#7C2D12",
        color: "#FED7AA",
        textAlign: "center",
        fontSize: "13px",
        fontWeight: 500,
        padding: "8px 16px",
        letterSpacing: "0.01em",
      }}
    >
      ⚠️ No internet connection — you're working offline. Your session is saved.
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useApp();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p style={{ color: "#888" }} className="text-sm">Loading Manuskripta...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    setTimeout(() => setLocation("/login"), 0);
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/">
        {() => <AuthGuard><DashboardPage /></AuthGuard>}
      </Route>
      <Route path="/create-book">
        {() => <AuthGuard><CreateBookPage /></AuthGuard>}
      </Route>
      <Route path="/format-book">
        {() => <AuthGuard><FormatBookPage /></AuthGuard>}
      </Route>
      <Route path="/book/:id">
        {(params) => <AuthGuard><BookDetailsPage id={params.id} /></AuthGuard>}
      </Route>
      <Route path="/reader/:id">
        {(params) => <AuthGuard><ReaderPage id={params.id} /></AuthGuard>}
      </Route>
      <Route path="/admin">
        {() => <AuthGuard><AdminPage /></AuthGuard>}
      </Route>
      <Route path="/announcements">
        {() => <AuthGuard><AnnouncementsPage /></AuthGuard>}
      </Route>
      <Route path="/settings">
        {() => <AuthGuard><SettingsPage /></AuthGuard>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <OfflineBanner />
            <Router />
          </WouterRouter>
          <Toaster />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
