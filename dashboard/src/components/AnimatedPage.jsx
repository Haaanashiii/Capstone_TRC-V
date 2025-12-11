import React from 'react';
import { Box, Fade } from '@mui/material';

/**
 * AnimatedPage Component
 * Wrapper component that provides consistent page transition animations
 * 
 * @param {React.ReactNode} children - Page content to wrap
 * @param {string} animation - Animation type: 'fadeIn' | 'slideUp' | 'fadeInUp' | 'scaleIn' (default: 'fadeInUp')
 * @param {number} duration - Animation duration in ms (default: 400)
 * @param {number} delay - Animation delay in ms (default: 0)
 * @param {object} sx - Additional MUI sx styles
 */
const AnimatedPage = ({
  children,
  animation = 'fadeInUp',
  duration = 400,
  delay = 0,
  sx = {},
  ...props
}) => {
  // Animation keyframes definitions
  const animations = {
    fadeIn: {
      '@keyframes fadeIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
      animation: `fadeIn ${duration}ms ease-out ${delay}ms both`,
    },
    slideUp: {
      '@keyframes slideUp': {
        from: { opacity: 0, transform: 'translateY(30px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
      animation: `slideUp ${duration}ms ease-out ${delay}ms both`,
    },
    fadeInUp: {
      '@keyframes fadeInUp': {
        from: { opacity: 0, transform: 'translateY(20px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
      animation: `fadeInUp ${duration}ms ease-out ${delay}ms both`,
    },
    scaleIn: {
      '@keyframes scaleIn': {
        from: { opacity: 0, transform: 'scale(0.95)' },
        to: { opacity: 1, transform: 'scale(1)' },
      },
      animation: `scaleIn ${duration}ms ease-out ${delay}ms both`,
    },
    fadeInLeft: {
      '@keyframes fadeInLeft': {
        from: { opacity: 0, transform: 'translateX(-20px)' },
        to: { opacity: 1, transform: 'translateX(0)' },
      },
      animation: `fadeInLeft ${duration}ms ease-out ${delay}ms both`,
    },
    fadeInRight: {
      '@keyframes fadeInRight': {
        from: { opacity: 0, transform: 'translateX(20px)' },
        to: { opacity: 1, transform: 'translateX(0)' },
      },
      animation: `fadeInRight ${duration}ms ease-out ${delay}ms both`,
    },
  };

  const selectedAnimation = animations[animation] || animations.fadeInUp;

  return (
    <Box
      sx={{
        ...selectedAnimation,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

/**
 * AnimatedSection Component
 * For animating individual sections within a page with stagger effect
 * 
 * @param {React.ReactNode} children - Section content
 * @param {number} index - Index for stagger delay calculation
 * @param {string} animation - Animation type (default: 'fadeInUp')
 * @param {number} baseDelay - Base delay before stagger (default: 100)
 * @param {number} staggerDelay - Delay between each item (default: 50)
 */
export const AnimatedSection = ({
  children,
  index = 0,
  animation = 'fadeInUp',
  baseDelay = 100,
  staggerDelay = 50,
  sx = {},
  ...props
}) => {
  const delay = baseDelay + (index * staggerDelay);

  return (
    <AnimatedPage
      animation={animation}
      delay={delay}
      sx={sx}
      {...props}
    >
      {children}
    </AnimatedPage>
  );
};

/**
 * AnimatedList Component
 * For animating lists of items with staggered entrance
 * 
 * @param {Array} items - Array of items to render
 * @param {Function} renderItem - Render function for each item (item, index) => ReactNode
 * @param {string} keyExtractor - Key extractor function or property name
 * @param {number} baseDelay - Base delay before first item (default: 100)
 * @param {number} staggerDelay - Delay between items (default: 50)
 */
export const AnimatedList = ({
  items = [],
  renderItem,
  keyExtractor = '_id',
  baseDelay = 100,
  staggerDelay = 50,
  containerSx = {},
  itemSx = {},
}) => {
  const getKey = (item, index) => {
    if (typeof keyExtractor === 'function') {
      return keyExtractor(item, index);
    }
    return item[keyExtractor] || index;
  };

  return (
    <Box sx={containerSx}>
      {items.map((item, index) => (
        <AnimatedSection
          key={getKey(item, index)}
          index={index}
          baseDelay={baseDelay}
          staggerDelay={staggerDelay}
          sx={itemSx}
        >
          {renderItem(item, index)}
        </AnimatedSection>
      ))}
    </Box>
  );
};

/**
 * FadeTransition Component
 * Simple MUI Fade wrapper with consistent timing
 */
export const FadeTransition = ({
  children,
  in: inProp = true,
  timeout = 300,
  ...props
}) => {
  return (
    <Fade in={inProp} timeout={timeout} {...props}>
      <Box>{children}</Box>
    </Fade>
  );
};

export default AnimatedPage;
