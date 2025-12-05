import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';

const float = keyframes`
  0% {
    transform: translateY(100vh) scale(0);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) scale(1);
    opacity: 0;
  }
`;

const twinkle = keyframes`
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
`;

const StarsContainer = styled.div<{ $show: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
  ${props => !props.$show && css`display: none;`}
`;

const Star = styled.div<{
  $delay: number;
  $duration: number;
  $left: number;
  $size: number;
}>`
  position: absolute;
  left: ${props => props.$left}%;
  font-size: ${props => props.$size}px;
  animation: ${float} ${props => props.$duration}s ease-out ${props => props.$delay}s forwards,
             ${twinkle} 1s ease-in-out ${props => props.$delay + 0.5}s infinite;
  user-select: none;
`;

interface FloatingStarsProps {
  show: boolean;
  onComplete: () => void;
}

export const FloatingStars: React.FC<FloatingStarsProps> = ({ show, onComplete }) => {
  const [stars, setStars] = useState<Array<{
    id: number;
    delay: number;
    duration: number;
    left: number;
    size: number;
    emoji: string;
  }>>([]);

  useEffect(() => {
    if (show) {
      const starEmojis = ['✨', '⭐', '🌟', '💫', '✨'];
      const newStars = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 1.5,
        left: Math.random() * 100,
        size: 20 + Math.random() * 15,
        emoji: starEmojis[Math.floor(Math.random() * starEmojis.length)]
      }));

      setStars(newStars);

      const timer = setTimeout(() => {
        onComplete();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <StarsContainer $show={show}>
      {stars.map((star) => (
        <Star
          key={star.id}
          $delay={star.delay}
          $duration={star.duration}
          $left={star.left}
          $size={star.size}
        >
          {star.emoji}
        </Star>
      ))}
    </StarsContainer>
  );
};