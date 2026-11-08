import { BrowserRouter } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

import AppRoutes from "./components/AppRoutes";
import MobileNavigation from "./components/mobile/MobileNavigation";
import { AuthProvider } from "./contexts/AuthContext";
import { TestAccessProvider } from "./contexts/TestAccessContext";
import { TestAccessGate } from "./components/TestAccess";
import { isMobileLayoutEnabled } from "./constants/featureFlags";
import { useIsMobile } from "./hooks/useIsMobile";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import SyncStatus from "./components/SyncStatus";

function App() {
  // The mobile bottom navigation is additive: it renders only when the
  // build-time flag is enabled AND the viewport is at or below the breakpoint.
  // Desktop navigation and routes are untouched (issue #201, Phase 1).
  const mobileLayoutEnabled = isMobileLayoutEnabled()
  const isMobile = useIsMobile()
  const showMobileNav = mobileLayoutEnabled && isMobile

  return (
    <TestAccessProvider>
      <AuthProvider>
        <BrowserRouter>
          <TestAccessGate>
            <Header />
            <main
              className={
                showMobileNav ? "app-main app-main--with-mobile-nav" : "app-main"
              }
            >
              <AppRoutes />
            </main>
            <Footer />
            {showMobileNav && <MobileNavigation />}
            <PwaUpdatePrompt />
            <SyncStatus />
          </TestAccessGate>
        </BrowserRouter>
      </AuthProvider>
    </TestAccessProvider>
  );
}

export default App;

