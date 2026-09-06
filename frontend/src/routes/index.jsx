import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Dashboard from '../pages/dashboard/Dashboard';
import AttackFeed from '../pages/attack-feed/AttackFeed';
import HoneypotLab from '../pages/honeypot-lab/HoneypotLab';
import Agent from '../pages/agent/Agent';
import Reports from '../pages/reports/Reports';
import WAFManager from '../pages/waf/WAFManager';
import SandboxDashboard from '../pages/sandbox/SandboxDashboard';
import AttackerProfiles from '../pages/attackers/AttackerProfiles';
import PlaybooksConsole from '../pages/playbooks/PlaybooksConsole';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Dashboard />
      },
      {
        path: 'dashboard',
        element: <Dashboard />
      },
      {
        path: 'honeypot',
        element: <Navigate to="/sensors" replace />
      },
      {
        path: 'threat-intelligence',
        element: <Navigate to="/attackers" replace />
      },
      {
        path: 'admin',
        element: <Navigate to="/" replace />
      },
      {
        path: 'admin/dashboard',
        element: <Navigate to="/" replace />
      },
      {
        path: 'admin/logs',
        element: <Navigate to="/attacks" replace />
      },
      {
        path: 'admin/reports',
        element: <Navigate to="/reports" replace />
      },
      {
        path: 'attacks',
        element: <AttackFeed />
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
      }
    ]
  }
]);

export default router;
