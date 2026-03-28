import { motion } from 'framer-motion';
import './GlassCard.css';

/**
 * Reusable glassmorphism card with animated border glow.
 * Accepts variant: 'default' | 'purple' | 'danger' | 'success'
 */
export default function GlassCard({
  children,
  title,
  icon,
  variant = 'default',
  className = '',
  animate = true,
  style,
  id,
}) {
  const Wrapper = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
      }
    : {};

  return (
    <Wrapper
      className={`glass-card glass-card--${variant} ${className}`}
      style={style}
      id={id}
      {...motionProps}
    >
      <div className="glass-card__glow" />
      {title && (
        <div className="glass-card__header">
          {icon && <span className="glass-card__icon">{icon}</span>}
          <h3 className="glass-card__title">{title}</h3>
        </div>
      )}
      <div className="glass-card__body">{children}</div>
      <div className="glass-card__scanline" />
    </Wrapper>
  );
}
