import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { WindowHeader } from './components/desktop/WindowHeader';
import { Sidebar } from './components/desktop/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { Modals } from './components/common/Modals';

// Views
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { OptimizationView } from './components/views/OptimizationView';
import { PlansView } from './components/views/PlansView';
import { ComputerView } from './components/views/ComputerView';
import { HistoryView } from './components/views/HistoryView';
import { ProfileView } from './components/views/ProfileView';
import { SettingsView } from './components/views/SettingsView';
import { AdminView } from './components/views/AdminView';
import { LanguagesView } from './components/views/LanguagesView';

const MainAppContent: React.FC = () => {
  const { currentUser, currentView } = useApp();

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'optimization':
        return <OptimizationView />;
      case 'plans':
        return <PlansView />;
      case 'computer':
        return <ComputerView />;
      case 'languages':
        return <LanguagesView />;
      case 'history':
        return <HistoryView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        return <AdminView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#08080c] text-zinc-100 overflow-hidden select-none">
      {/* Desktop Window Chrome */}
      <WindowHeader />

      {/* Main App Canvas */}
      {!currentUser ? (
        <main className="flex-1 overflow-y-auto bg-[#0a0a0f]">
          <AuthView />
        </main>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Fixed Desktop Sidebar */}
          <Sidebar />

          {/* Main Desktop Work Area */}
          <main className="flex-1 overflow-y-auto bg-[#09090e] relative">
            {renderActiveView()}
          </main>
        </div>
      )}

      {/* Toast Notification Layer */}
      <ToastContainer />

      {/* Global Modals (Upgrade, Legal, Support) */}
      <Modals />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
