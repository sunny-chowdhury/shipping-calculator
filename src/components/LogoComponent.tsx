import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Logo = styled.img`
  height: 100px;
  width: auto;
  opacity: 0.9;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 1;
  }
`;

const LogoPlaceholder = styled.div`
  height: 100px;
  width: 100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

export const LogoComponent: React.FC = () => {
  const [logoExists, setLogoExists] = useState(false);

  useEffect(() => {
    // Check if logo file exists
    const img = new Image();
    img.onload = () => setLogoExists(true);
    img.onerror = () => setLogoExists(false);
    img.src = '/LoopLogo.png';
  }, []);

  if (logoExists) {
    return <Logo src="/LoopLogo.png" alt="Loop Logo" />;
  }

  return (
    <LogoPlaceholder title="Add LoopLogo.png to /public folder to replace this placeholder">
      L
    </LogoPlaceholder>
  );
};