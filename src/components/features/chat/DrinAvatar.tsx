/**
 * Drin's face: a friendly man with swept-back brown hair, rectangular glasses and a short, neat beard, drawn as a small picture
 * (decoration; the name is written next to it).
 */
export function DrinAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className} focusable="false">
      <circle cx="32" cy="32" r="32" fill="#efe9ff" />
      {/* neck, then jacket with a white shirt collar */}
      <path d="M27 40h10v8.500c-2 3-8 3-10 0z" fill="#e3ae87" />
      <path d="M5 64c2-11 12-16.500 27-16.500S57 53 59 64z" fill="#2a2563" />
      <path d="M25.500 47.800 32 56l6.500-8.200c-3.500 1.500-9.500 1.500-13 0z" fill="#fff" />
      <path d="M32 56l-2.500 8h5z" fill="#6d4aff" />
      {/* ears, face and a touch of shadow under the jaw */}
      <circle cx="19.800" cy="31.500" r="2.700" fill="#e8b48c" />
      <circle cx="44.200" cy="31.500" r="2.700" fill="#e8b48c" />
      <path d="M20 26c0-8.800 5-13.500 12-13.500S44 17.200 44 26v7c0 8.500-5 14-12 14s-12-5.500-12-14z" fill="#f2c9a5" />
      {/* short neat beard and moustache, smile left open */}
      <path
        d="M20.200 29c.2 11 5 18 11.800 18s11.600-7 11.800-18c-1 4.500-2.600 6.500-5.300 7.600-2-1.700-4.200-2.400-6.500-2.400s-4.500.7-6.500 2.400c-2.700-1.100-4.300-3.100-5.300-7.600z"
        fill="#5a3720"
      />
      <path
        d="M25.500 36.500c2.600-2.200 4.600-1.800 6.500-.8 1.900-1 3.900-1.400 6.500.8-2.500 1.700-4.600 1.200-6.500.5-1.900.7-4 1.200-6.500-.5z"
        fill="#5a3720"
      />
      <path d="M28.200 40.200q3.800 3.800 7.600 0z" fill="#fff" />
      {/* brown hair, swept up and back */}
      <path
        d="M19.600 29C17 16.500 23 8.200 33 8.200c9.500 0 14.800 6.500 11.400 20.800-1-5.700-3-9.200-6.900-10.700-3.500 1.700-9.500 1.300-13.600-.8-2.200 3-3.400 6.700-4.300 10.500z"
        fill="#6b4226"
      />
      <path d="M25 13.200c4-3.200 11-3.700 15.500-.4" fill="none" stroke="#9a6a3f" strokeWidth="1.500" strokeLinecap="round" />
      {/* nose, eyebrows and eyes */}
      <path d="M32 28.500q2 4-.5 5.200" fill="none" stroke="#d29a72" strokeWidth="1.200" strokeLinecap="round" />
      <path d="M22.300 24.300q4.500-2.400 8.200-.4M33.500 23.900q3.700-2 8.200.4" fill="none" stroke="#5a3720" strokeWidth="1.900" strokeLinecap="round" />
      <ellipse cx="26.300" cy="28.900" rx="2.300" ry="1.700" fill="#fff" />
      <ellipse cx="37.700" cy="28.900" rx="2.300" ry="1.700" fill="#fff" />
      <circle cx="26.500" cy="28.900" r="1.250" fill="#3b2a1f" />
      <circle cx="37.500" cy="28.900" r="1.250" fill="#3b2a1f" />
      {/* rectangular glasses */}
      <rect x="21.500" y="25.300" width="9.600" height="7.200" rx="2" fill="#fff" fillOpacity=".22" stroke="#1b1340" strokeWidth="1.500" />
      <rect x="32.900" y="25.300" width="9.600" height="7.200" rx="2" fill="#fff" fillOpacity=".22" stroke="#1b1340" strokeWidth="1.500" />
      <path
        d="M31.100 27.800q.9-.9 1.800 0M21.500 27.300 19.800 26.800M42.500 27.300l1.700-.5"
        fill="none"
        stroke="#1b1340"
        strokeWidth="1.500"
        strokeLinecap="round"
      />
    </svg>
  );
}
