import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { FiActivity, FiCpu } from 'react-icons/fi';
import { RiDashboardFill, RiPulseFill, RiServerFill } from 'react-icons/ri';
import StatusDot from '../ui/StatusDot';
import useSignalStore from '../../store/useSignalStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: RiDashboardFill },
  { path: '/signal-lab', label: 'Signal Lab', icon: FiActivity },
  { path: '/quantum-lab', label: 'Quantum Lab', icon: FiCpu },
  { path: '/nyquist', label: 'Nyquist', icon: RiPulseFill },
  { path: '/status', label: 'Status', icon: RiServerFill },
];

export default function Sidebar() {
  const connected = useSignalStore((state) => state.connected);
  const location = useLocation();

  return (
    <nav className="sidebar" id="sidebar-nav">
      <div className="sidebar__brand">
        <Link className="sidebar__brand-link" to="/">
          <span className="sidebar__brand-mark">QS</span>
          <span className="sidebar__brand-copy">
            <strong>Quantum</strong>
            <small>Studio</small>
          </span>
        </Link>
      </div>

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
              id={`nav-${item.path.replace('/', '')}`}
            >
              {isActive && (
                <Motion.div
                  className="sidebar__active-bg"
                  layoutId="activeNav"
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                />
              )}
              <Icon className="sidebar__icon" />
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="sidebar__footer">
        <StatusDot
          status={connected ? 'online' : 'offline'}
          size={8}
          label={connected ? 'Realtime link' : 'Offline'}
        />
        <Link className="sidebar__home" to="/">
          Front Page
        </Link>
      </div>
    </nav>
  );
}
