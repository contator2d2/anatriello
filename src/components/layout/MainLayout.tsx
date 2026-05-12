import { ReactNode } from "react";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MessageNotifications } from "./MessageNotifications";
import { CRMAlerts } from "./CRMAlerts";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { GroupSecretaryPopup } from "./GroupSecretaryPopup";
import { PWAUpdateBanner } from "./PWAUpdateBanner";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Sidebar />
      <TopBar />
      
      {/* Mobile/Tablet TopBar with notifications */}
      <div className="xl:hidden fixed top-0 right-0 left-12 h-14 flex items-center justify-end gap-2 px-3 bg-background/95 backdrop-blur-sm border-b border-border/50 z-50"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <ConnectionStatusIndicator />
        <div className="h-5 w-px bg-border" />
        <MessageNotifications />
        <CRMAlerts />
      </div>
      
      {/* Desktop: margin-left for collapsed sidebar + top bar, Mobile/Tablet: no margin */}
      <main className="xl:ml-16 pt-14 xl:pt-12 overflow-x-hidden w-full xl:w-[calc(100vw-4rem)] box-border"
        style={{ paddingTop: 'max(3.5rem, calc(env(safe-area-inset-top, 0px) + 3.5rem))' }}>
        <div className="p-2 xl:p-3 2xl:p-4 w-full min-w-0 overflow-x-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>{children}</div>
      </main>
      <GroupSecretaryPopup />
      <PWAUpdateBanner />
    </div>
  );
}
