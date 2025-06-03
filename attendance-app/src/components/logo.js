import React from 'react';

export default function Logo({ className }) {
  return (
    <img
      src="/favicon.png"           // carrega direto de public/
      alt="ADVárzea Belém"
      className={className || 'app-logo'}
    />
  );
}
