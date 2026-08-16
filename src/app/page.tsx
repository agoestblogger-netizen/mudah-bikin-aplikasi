'use client';

import React, { useState } from 'react';
import { AppProjectState, PRDStage } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { Stage1InterviewAI } from '@/components/Stage1InterviewAI';
import { Stage2MockupCanvas } from '@/components/Stage2MockupCanvas';
import { Stage3BriefLock } from '@/components/Stage3BriefLock';
import { Stage4GASBackend } from '@/components/Stage4GASBackend';
import { Stage5FeaturePatch } from '@/components/Stage5FeaturePatch';
import { Stage6Troubleshooter } from '@/components/Stage6Troubleshooter';

export default function Home() {
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);

  const handleUpdateState = (updated: Partial<AppProjectState>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updated,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSelectStage = (stage: PRDStage) => {
    setProjectState((prev) => ({
      ...prev,
      currentStage: stage
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentStage={projectState.currentStage}
        onSelectStage={handleSelectStage}
        projectTitle={projectState.title}
        auditScore={projectState.qualityAudit.totalScore}
      />

      {/* Main Content Area: 6 Official PRD Stages */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {projectState.currentStage === 'TAHAP_1_PEMBUKAAN' && (
          <Stage1InterviewAI
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextStage={() => handleSelectStage('TAHAP_2_MOCKUP')}
          />
        )}

        {projectState.currentStage === 'TAHAP_2_MOCKUP' && (
          <Stage2MockupCanvas
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextStage={() => handleSelectStage('TAHAP_3_KUNCI_KEBUTUHAN')}
          />
        )}

        {projectState.currentStage === 'TAHAP_3_KUNCI_KEBUTUHAN' && (
          <Stage3BriefLock
            projectState={projectState}
            onNextStage={() => handleSelectStage('TAHAP_4_BACKEND')}
          />
        )}

        {projectState.currentStage === 'TAHAP_4_BACKEND' && (
          <Stage4GASBackend
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextStage={() => handleSelectStage('TAHAP_5_PATCH')}
          />
        )}

        {projectState.currentStage === 'TAHAP_5_PATCH' && (
          <Stage5FeaturePatch
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextStage={() => handleSelectStage('TAHAP_6_TROUBLESHOOTING')}
          />
        )}

        {projectState.currentStage === 'TAHAP_6_TROUBLESHOOTING' && (
          <Stage6Troubleshooter projectState={projectState} />
        )}
      </main>
    </div>
  );
}
