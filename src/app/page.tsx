'use client';

import React, { useState } from 'react';
import { AppProjectState, AppPhase } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { Phase0Welcome } from '@/components/Phase0Welcome';
import { Phase1Interview } from '@/components/Phase1Interview';
import { Phase2CanvasStudio } from '@/components/Phase2CanvasStudio';
import { Phase3BriefContract } from '@/components/Phase3BriefContract';
import { Phase4GASBuilder } from '@/components/Phase4GASBuilder';
import { Phase5DeployAudit } from '@/components/Phase5DeployAudit';

export default function Home() {
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);

  const handleUpdateState = (updated: Partial<AppProjectState>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updated,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSelectPhase = (phase: AppPhase) => {
    setProjectState((prev) => ({
      ...prev,
      currentPhase: phase
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentPhase={projectState.currentPhase}
        onSelectPhase={handleSelectPhase}
        projectTitle={projectState.title}
        auditScore={projectState.qualityAudit.totalScore}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {projectState.currentPhase === 'FASE_0_WELCOME' && (
          <Phase0Welcome
            projectState={projectState}
            onNavigatePhase={handleSelectPhase}
          />
        )}

        {projectState.currentPhase === 'FASE_1_INTERVIEW' && (
          <Phase1Interview
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextPhase={() => handleSelectPhase('FASE_2_CANVAS')}
          />
        )}

        {projectState.currentPhase === 'FASE_2_CANVAS' && (
          <Phase2CanvasStudio
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextPhase={() => handleSelectPhase('FASE_3_BRIEF')}
          />
        )}

        {projectState.currentPhase === 'FASE_3_BRIEF' && (
          <Phase3BriefContract
            projectState={projectState}
            onNextPhase={() => handleSelectPhase('FASE_4_GAS_BACKEND')}
          />
        )}

        {projectState.currentPhase === 'FASE_4_GAS_BACKEND' && (
          <Phase4GASBuilder
            projectState={projectState}
            onUpdateState={handleUpdateState}
            onNextPhase={() => handleSelectPhase('FASE_5_DEPLOY')}
          />
        )}

        {projectState.currentPhase === 'FASE_5_DEPLOY' && (
          <Phase5DeployAudit projectState={projectState} />
        )}
      </main>
    </div>
  );
}
