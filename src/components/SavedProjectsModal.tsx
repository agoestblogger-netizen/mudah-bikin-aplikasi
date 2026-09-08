'use client';

import React, { useEffect } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { SavedProjectsList } from './SavedProjectsList';
import type { SavedProject } from '@/types/app';

interface SavedProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: SavedProject[];
  loading: boolean;
  deletingId: string | null;
  onLoad: (project: SavedProject) => void;
  onDelete: (id: string) => void;
}

export const SavedProjectsModal: React.FC<SavedProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  loading,
  deletingId,
  onLoad,
  onDelete,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-3xl max-h-[85vh] bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121217]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#10f48e]/15 border border-[#10f48e]/30 flex items-center justify-center text-[#10f48e]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Proyek Tersimpan</h3>
              <p className="text-xs text-slate-400">Pilih proyek untuk melanjutkan pengeditan atau pratinjau</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="Tutup (Esc)"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <SavedProjectsList
            projects={projects}
            loading={loading}
            deletingId={deletingId}
            onLoad={(project) => {
              onLoad(project);
              onClose();
            }}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
};
