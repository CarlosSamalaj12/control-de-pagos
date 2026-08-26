// src/components/profile/ProfileAvatar.tsx
interface ProfileAvatarProps {
  nombre: string;
  iniciales: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export function ProfileAvatar({ nombre, iniciales, color, size = 'md' }: ProfileAvatarProps) {
  return (
    <div
      className={`${SIZE_CLASS[size]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: color }}
      aria-label={nombre}
    >
      {iniciales}
    </div>
  );
}
