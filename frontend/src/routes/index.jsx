import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Dashboard from '../pages/dashboard/Dashboard';
import AttackFeed from '../pages/attack-feed/AttackFeed';
import HoneypotLab from '../pages/honeypot-lab/HoneypotLab';
import Agent from '../pages/agent/Agent';
import Reports from '../pages/reports/Reports';
import SettingsPage from '../pages/settings/Settings';
import WAFManager from '../pages/waf/WAFManager';
import CorrelationDashboard from '../pages/correlation/CorrelationDashboard';
import SandboxDashboard from '../pages/sandbox/SandboxDashboard';
import AttackerProfiles from '../pages/attackers/AttackerProfiles';
import PlaybooksConsole from '../pages/playbooks/PlaybooksConsole';

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        path: '',
        element: <Dashboard />
      },
      {
        path: 'attacks',
        element: <AttackFeed />
      },
      {
        path: 'correlation',
        element: <CorrelationDashboard />
      },
      {
        path: 'sandbox',
        element: <SandboxDashboard />
      },
      {
        path: 'attackers',
        element: <AttackerProfiles />
      },
      {
        path: 'playbooks',
        element: <PlaybooksConsole />
      },
      {
        path: 'waf',
        element: <WAFManager />
      },
      {
        path: 'sensors',
        element: <HoneypotLab />
      },
      {
        path: 'agent',
        element: <Agent />
      },
      {
        path: 'reports',
        element: <Reports />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      }
    ]
  }
]);

export default router;
