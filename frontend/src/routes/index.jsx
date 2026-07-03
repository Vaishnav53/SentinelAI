import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Dashboard from '../pages/dashboard/Dashboard';
import AttackFeed from '../pages/attack-feed/AttackFeed';
import HoneypotLab from '../pages/honeypot-lab/HoneypotLab';
import Agent from '../pages/agent/Agent';
import Reports from '../pages/reports/Reports';
import SettingsPage from '../pages/settings/Settings';
import Blueprint from '../pages/blueprint/Blueprint';
import WAFManager from '../pages/waf/WAFManager';

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
      },
      {
        path: 'blueprint',
        element: <Blueprint />
      }
    ]
  }
]);

export default router;
