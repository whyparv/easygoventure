import { initials } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';

// Sage Luxury avatar palette — brand-aligned tints with darker, WCAG-safe initials.
const PALETTE = [
  'bg-[#3F6F63]/12 text-[#31564c]',
  'bg-[#5F8E83]/15 text-[#456b61]',
  'bg-[#C65B5B]/12 text-[#a24747]',
  'bg-[#D9A441]/16 text-[#8a6420]',
  'bg-[#4F8A5B]/12 text-[#3d6b47]',
  'bg-[#b3708f]/14 text-[#8a5570]',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        colorFor(name),
        className,
      )}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  );
}
