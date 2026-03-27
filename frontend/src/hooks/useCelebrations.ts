import { useEffect, useState } from 'react';
import { api } from '@/integrations/api/client';

export interface CelebrationType {
  type: 'birthday' | 'anniversary';
  label: string;
  emoji: string;
}

export interface CelebrationPerson {
  userId: string;
  fullName: string;
  jobTitle: string;
  department: string;
  avatarUrl: string | null;
  types: CelebrationType[];
  alreadyWished: {
    birthday: boolean;
    anniversary: boolean;
  };
}

export function useCelebrations(isAuthenticated: boolean) {
  const [celebrations, setCelebrations] = useState<CelebrationPerson[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function check() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const shownDate = localStorage.getItem('celebration_shown_date');
        if (shownDate === today) return;

        const { data } = await api.get<{ celebrations: CelebrationPerson[] }>('/celebrations/today');
        if (data?.celebrations?.length) {
          setCelebrations(data.celebrations);
          setShowModal(true);
          localStorage.setItem('celebration_shown_date', today);
        }
      } catch (err) {
        console.warn('Celebrations check failed:', err);
      }
    }

    const t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  const handleWishSent = () => setShowModal(false);
  const closeModal = () => setShowModal(false);

  return { celebrations, showModal, closeModal, handleWishSent };
}
