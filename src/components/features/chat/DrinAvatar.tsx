/** Drin's face: a man with round glasses and a short, neat beard, drawn as a small picture (decoration; the name is written next to it). */
export function DrinAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className} focusable="false">
      <circle cx="32" cy="32" r="32" fill="#efe9ff" />
      {/* shoulders and neck */}
      <path d="M6 64c2-12 13-17 26-17s24 5 26 17z" fill="#1b1340" />
      <path d="M27 40h10v9c-2 2-8 2-10 0z" fill="#e0b088" />
      {/* ears and face */}
      <circle cx="19.5" cy="31" r="2.6" fill="#e8b890" />
      <circle cx="44.5" cy="31" r="2.6" fill="#e8b890" />
      <ellipse cx="32" cy="30" rx="13" ry="15.5" fill="#f1c7a0" />
      {/* short hair */}
      <path d="M18.8 28C17.5 14.5 27 10.5 33 10.5c9 0 14.5 6.5 12.2 17.5C43.5 22 38.5 18.5 32 18.5S21 22 18.8 28z" fill="#2e2019" />
      {/* clean beard and moustache, with the smile left open */}
      <path d="M19 31c0 10 5 16 13 16s13-6 13-16c-1 4-3 6-6 6-2-2-5-3-7-3s-5 1-7 3c-3 0-5-2-6-6z" fill="#2e2019" />
      <path d="M26 37c2-2 4-2.800 6-2.800S36 35 38 37c-2 1.200-4 .8-6 .2-2 .6-4 1-6-.2z" fill="#2e2019" />
      <path d="M28.5 40.5q3.5 2.8 7 0" fill="none" stroke="#f4dccb" strokeWidth="1.600" strokeLinecap="round" />
      {/* nose */}
      <path d="M32 30.500q1.600 3.500-.4 4" fill="none" stroke="#d9a47f" strokeWidth="1.200" strokeLinecap="round" />
      {/* eyebrows and eyes */}
      <path d="M22.500 24.200q4-2 7.500 0M34 24.200q3.500-2 7.500 0" fill="none" stroke="#2e2019" strokeWidth="1.600" strokeLinecap="round" />
      <circle cx="26.500" cy="29.800" r="1.200" fill="#1b1340" />
      <circle cx="37.500" cy="29.800" r="1.200" fill="#1b1340" />
      {/* round glasses */}
      <circle cx="26.500" cy="29.500" r="5" fill="#fff" fillOpacity=".35" stroke="#1b1340" strokeWidth="1.600" />
      <circle cx="37.500" cy="29.500" r="5" fill="#fff" fillOpacity=".35" stroke="#1b1340" strokeWidth="1.600" />
      <path d="M31.500 29q.5-1 1 0M21.500 29l-2-.5M42.500 29l2-.5" fill="none" stroke="#1b1340" strokeWidth="1.500" strokeLinecap="round" />
    </svg>
  );
}
