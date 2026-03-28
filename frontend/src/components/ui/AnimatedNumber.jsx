import { useSpring, animated } from '@react-spring/web';

/**
 * Number that smoothly animates between values.
 */
export default function AnimatedNumber({
  value,
  decimals = 1,
  prefix = '',
  suffix = '',
  className = '',
  style,
}) {
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;

  const spring = useSpring({
    val: numValue,
    from: { val: 0 },
    config: { tension: 120, friction: 20 },
  });

  return (
    <animated.span className={className} style={style}>
      {spring.val.to((v) => `${prefix}${v.toFixed(decimals)}${suffix}`)}
    </animated.span>
  );
}
