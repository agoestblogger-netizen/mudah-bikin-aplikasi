import React, { useState } from 'react';
import {
  Sparkles,
  Store,
  Truck,
  MapPin,
  Repeat,
  Clock,
  Package,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Database,
  Coins,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import type { DomainProfile } from '../lib/templates/processes/types';

interface DomainMindMapCardProps {
  profile: DomainProfile;
  domainTitle?: string;
  isCompact?: boolean;
}

export const DomainMindMapCard: React.FC<DomainMindMapCardProps> = ({
  profile,
  domainTitle = 'Domain Bisnis',
  isCompact = false
}) => {
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  const toggleBranch = (branchId: string) => {
    setExpandedBranch((prev) => (prev === branchId ? null : branchId));
  };

  const getModelOperasionalLabel = (model: DomainProfile['modelOperasional']) => {
    switch (model) {
      case 'DI_TEMPAT':
        return { label: 'Di Tempat / Counter', desc: 'Pelanggan datang langsung ke lokasi fisik untuk bertransaksi.', icon: Store };
      case 'PENGIRIMAN_LOGISTIK':
        return { label: 'Pengiriman & Logistik', desc: 'Pesanan dikirim via kurir, armada, atau ekspedisi pengiriman.', icon: Truck };
      case 'DIGITAL':
      default:
        return { label: 'Layanan Digital / Online', desc: 'Transaksi dan pengiriman diproses secara sistem digital.', icon: Sparkles };
    }
  };

  const getModelTarifLabel = (tarif: DomainProfile['modelTarif']) => {
    switch (tarif) {
      case 'SEWA_DURASI':
        return { label: 'Sewa Berdasarkan Durasi', desc: 'Kalkulasi dihitung per jam, hari, atau periode sewa.', icon: Clock };
      case 'BERAT_TIMBANGAN':
        return { label: 'Tarif per Berat / Timbangan', desc: 'Dihitung berdasarkan berat kilogram/volume (misal: laundry kiloan).', icon: Layers };
      case 'PER_ITEM':
        return { label: 'Tarif per Satuan Item / Produk', desc: 'Dihitung per kuantitas (qty) barang fisik yang dijual.', icon: Package };
      case 'BIAYA_JASA':
      default:
        return { label: 'Tarif Berdasarkan Jasa / Layanan', desc: 'Dihitung per paket tindakan, tarif flat, atau pengerjaan jasa.', icon: Coins };
    }
  };

  const operasional = getModelOperasionalLabel(profile.modelOperasional);
  const tarif = getModelTarifLabel(profile.modelTarif);
  const OperasionalIcon = operasional.icon;
  const TarifIcon = tarif.icon;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#0c0c11] overflow-hidden shadow-xl">
      {/* Header Mind-Map */}
      <div className="p-3.5 bg-gradient-to-r from-[#10f48e]/10 via-white/[0.02] to-transparent border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#10f48e]/20 flex items-center justify-center text-[#10f48e]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[12px] font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>Peta Profil & Kelaziman Bisnis</span>
              <span className="text-[10px] text-[#10f48e] font-mono bg-[#10f48e]/10 px-1.5 py-0.5 rounded">
                Mind-Map
              </span>
            </h4>
            <p className="text-[10px] text-zinc-400">
              Acuan batas kelaziman untuk Role, Alur, Formula, dan Skema Data
            </p>
          </div>
        </div>
      </div>

      {/* Visual Tree Mind-Map */}
      <div className="p-3.5 space-y-3">
        {/* Center Node (Domain Root) */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#10f48e]/15 border border-[#10f48e]/30 text-[#10f48e] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#10f48e] animate-pulse" />
            <span className="text-[11.5px] font-bold tracking-wide uppercase">
              {domainTitle}
            </span>
          </div>
          {/* Connector Line to Branches */}
          <div className="w-px h-3 bg-gradient-to-b from-[#10f48e]/40 to-white/15 my-0.5" />
        </div>

        {/* Mind-Map Grid / Branches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Branch 1: Model Operasional */}
          <div
            onClick={() => toggleBranch('operasional')}
            className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left ${
              expandedBranch === 'operasional'
                ? 'bg-white/[0.06] border-white/25 shadow-md'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-sky-400/10 text-sky-400 flex items-center justify-center shrink-0">
                  <OperasionalIcon className="w-3 h-3" />
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Model Operasional
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {operasional.label}
                  </span>
                </div>
              </div>
              {expandedBranch === 'operasional' ? (
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              )}
            </div>
            {expandedBranch === 'operasional' && (
              <p className="text-[10px] text-zinc-400 mt-2 pt-2 border-t border-white/10 leading-relaxed">
                {operasional.desc}
              </p>
            )}
          </div>

          {/* Branch 2: Model Tarif */}
          <div
            onClick={() => toggleBranch('tarif')}
            className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left ${
              expandedBranch === 'tarif'
                ? 'bg-white/[0.06] border-white/25 shadow-md'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                  <TarifIcon className="w-3 h-3" />
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Model Tarif & Waktu
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {tarif.label}
                  </span>
                </div>
              </div>
              {expandedBranch === 'tarif' ? (
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              )}
            </div>
            {expandedBranch === 'tarif' && (
              <p className="text-[10px] text-zinc-400 mt-2 pt-2 border-t border-white/10 leading-relaxed">
                {tarif.desc}
              </p>
            )}
          </div>

          {/* Branch 3: Jaminan / Deposit */}
          <div
            onClick={() => toggleBranch('deposit')}
            className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left ${
              expandedBranch === 'deposit'
                ? 'bg-white/[0.06] border-white/25 shadow-md'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    profile.adaJaminanDeposit
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : 'bg-zinc-700/30 text-zinc-500'
                  }`}
                >
                  {profile.adaJaminanDeposit ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : (
                    <ShieldAlert className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Jaminan / Deposit
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {profile.adaJaminanDeposit ? 'Ada Jaminan Fisik' : 'Tanpa Jaminan'}
                  </span>
                </div>
              </div>
              {expandedBranch === 'deposit' ? (
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              )}
            </div>
            {expandedBranch === 'deposit' && (
              <p className="text-[10px] text-zinc-400 mt-2 pt-2 border-t border-white/10 leading-relaxed">
                {profile.fungsiDeposit || (profile.adaJaminanDeposit ? 'Jaminan fisik unit selama masa sewa.' : 'Tidak memerlukan titip uang muka jaminan.')}
              </p>
            )}
          </div>

          {/* Branch 4: Struktur Data (Katalog & Transaksi) */}
          <div
            onClick={() => toggleBranch('entitas')}
            className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left ${
              expandedBranch === 'entitas'
                ? 'bg-white/[0.06] border-white/25 shadow-md'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-purple-400/10 text-purple-400 flex items-center justify-center shrink-0">
                  <Database className="w-3 h-3" />
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Struktur Data Inti
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {profile.entitasKatalogMaster.length} Katalog • {profile.entitasPencatatanTransaksi.length} Transaksi
                  </span>
                </div>
              </div>
              {expandedBranch === 'entitas' ? (
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              )}
            </div>
            {expandedBranch === 'entitas' && (
              <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5 text-[10px]">
                <div>
                  <span className="text-zinc-500 font-medium">Master: </span>
                  <span className="text-zinc-300 font-mono">
                    {profile.entitasKatalogMaster.join(', ') || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 font-medium">Transaksi: </span>
                  <span className="text-zinc-300 font-mono">
                    {profile.entitasPencatatanTransaksi.join(', ') || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Branch 5: Strict Whitelist Komponen Biaya Sah */}
        <div className="rounded-xl border border-[#10f48e]/20 bg-[#10f48e]/[0.03] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-[#10f48e]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#10f48e]">
                Whitelist Komponen Biaya Sah
              </span>
            </div>
            <span className="text-[9px] text-zinc-400">
              Strict Whitelist (Di luar ini ditolak otomatis)
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile.komponenBiayaYangLazim.map((komponen, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-zinc-200 font-mono"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-[#10f48e]" />
                {komponen}
              </span>
            ))}
          </div>
        </div>

        {/* Catatan Bisnis & Batasan Kelaziman */}
        {profile.catatanOperasional && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[9.5px] text-zinc-400 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span>{profile.catatanOperasional}</span>
          </div>
        )}
      </div>
    </div>
  );
};
