import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiActivity, FiCpu } from 'react-icons/fi';
import {
  RiDashboardFill,
  RiPulseFill,
  RiServerFill,
} from 'react-icons/ri';
import StatusDot from '../ui/StatusDot';
import useSignalStore from '../../store/useSignalStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: RiDashboardFill },
  { path: '/signal-lab', label: 'Signal Lab', icon: FiActivity },
  { path: '/quantum-lab', label: 'Quantum Lab', icon: FiCpu },
  { path: '/nyquist', label: 'Nyquist', icon: RiPulseFill },
  { path: '/status', label: 'Status', icon: RiServerFill },
];

export default function Sidebar() {
  const connected = useSignalStore((s) => s.connected);
  const location = useLocation();

  return (
    <nav className="sidebar" id="sidebar-nav">
      {/* Logo */}
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon">◈</span>
      </div>

      {/* Navigation */}
      <div className="sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: routeActive }) =>
                `sidebar__link ${routeActive ? 'sidebar__link--active' : ''}`
              }
              id={`nav-${item.path.replace('/', '') || 'dashboard'}`}
            >
              {isActive && (
                <motion.div
                  className="sidebar__active-bg"
                  layoutId="activeNav"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="sidebar__icon" />
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <StatusDot
          status={connected ? 'online' : 'offline'}
          size={6}
        />
        <span className="sidebar__version">v2.0</span>
      </div>
    </nav>
  );
}
