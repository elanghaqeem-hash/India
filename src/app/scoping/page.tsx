'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSearch,
  ShieldAlert,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Info,
} from 'lucide-react';
import { calculateVaptMandays, calculateSocSizing } from '@/lib/scoping-calculator';
import { VaptType, BoxMethod, ServiceType } from '@/lib/types';
import { formatIDR } from '@/lib/formatters';

export default function SmartScopingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'VAPT' | 'SOC'>('VAPT');

  // VAPT Form State
  const [vaptType, setVaptType] = useState<VaptType>('web_app');
  const [boxMethod, setBoxMethod] = useState<BoxMethod>('grey_box');
  const [isFinancial, setIsFinancial] = useState<boolean>(true);
  const [webComplexity, setWebComplexity] = useState<'simple' | 'medium' | 'complex' | 'critical'>('medium');
  const [apiEndpoints, setApiEndpoints] = useState<number>(15);
  const [userRoles, setUserRoles] = useState<number>(4);
  const [mobilePlatform, setMobilePlatform] = useState<'android' | 'ios' | 'both'>('both');
  const [mobileScreens, setMobileScreens] = useState<number>(18);
  const [infraHosts, setInfraHosts] = useState<number>(20);
  const [redteamScope, setRedteamScope] = useState<'assumed_breach' | 'limited' | 'standard' | 'full_apt'>('standard');

  // SOC Form State
  const [nServers, setNServers] = useState<number>(25);
  const [nNetwork, setNNetwork] = useState<number>(10);
  const [nEndpoints, setNEndpoints] = useState<number>(150);
  const [nCloud, setNCloud] = useState<number>(4);
  const [hasAD, setHasAD] = useState<boolean>(true);
  const [trafficIntensity, setTrafficIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [serviceLevel, setServiceLevel] = useState<'8x5' | '12x5' | '24x7'>('24x7');
  const [hasThreatHunting, setHasThreatHunting] = useState<boolean>(true);
  const [hasIR, setHasIR] = useState<boolean>(false);

  // Live Calculations
  const calculatedMD = calculateVaptMandays({
    vapt_type: vaptType,
    box_method: boxMethod,
    is_financial_compliance: isFinancial,
    web_complexity: webComplexity,
    web_n_api_endpoints: apiEndpoints,
    web_n_roles: userRoles,
    mobile_platform: mobilePlatform,
    mobile_n_screens: mobileScreens,
    net_n_internal_host: infraHosts,
    redteam_scope: redteamScope,
  });

  const socResult = calculateSocSizing({
    n_servers: nServers,
    n_network_devices: nNetwork,
    n_endpoints: nEndpoints,
    n_cloud_services: nCloud,
    has_active_directory: hasAD,
    traffic_intensity: trafficIntensity,
    service_level: serviceLevel,
    has_threat_hunting: hasThreatHunting,
    has_ir_retainer: hasIR,
  });

  const handleProceedToPricing = () => {
    if (activeTab === 'VAPT') {
      router.push(`/pricing?service=VAPT&md=${calculatedMD}&type=${vaptType}`);
    } else {
      router.push(`/pricing?service=SOC&eps=${socResult.calculated_eps}&mrc=${socResult.recommended_mrc}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <FileSearch className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Smart Scoping Assessment Engine</h1>
            <p className="text-xs text-slate-500">
              Formulir kalkulasi scoping teknis adaptif sesuai standar BRD Bab 3 & FRS DefendIT360.
            </p>
          </div>
        </div>
      </div>

      {/* Service Type Selection Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs max-w-md">
        <button
          onClick={() => setActiveTab('VAPT')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'VAPT'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>VAPT / Pentest Scoping</span>
        </button>
        <button
          onClick={() => setActiveTab('SOC')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SOC'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>SOC / MDR Sizing</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Form (Col 2) */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'VAPT' ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Parameter Teknis VAPT</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                  Rule-based Estimation
                </span>
              </h2>

              {/* VAPT Type Grid */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Pilar / Kategori Asset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'web_app', label: 'Web Application' },
                    { id: 'mobile_app', label: 'Mobile App (Android/iOS)' },
                    { id: 'api', label: 'API / Microservices' },
                    { id: 'network_infra', label: 'Network & Infra' },
                    { id: 'red_team', label: 'Red Team Simulation' },
                    { id: 'source_code', label: 'Source Code Review' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVaptType(t.id as VaptType)}
                      className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                        vaptType === t.id
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Box Methodology & Financial Trigger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Metodologi Uji</label>
                  <select
                    value={boxMethod}
                    onChange={e => setBoxMethod(e.target.value as BoxMethod)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="black_box">Black-Box (Faktor 0.9x)</option>
                    <option value="grey_box">Grey-Box (Standard 1.0x)</option>
                    <option value="white_box">White-Box / Source Code (Faktor 1.3x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Sektor Keuangan / Regulasi</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFinancial}
                        onChange={e => setIsFinancial(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Pemenuhan POJK / SEOJK / PCI-DSS (+2 MD)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Conditional Dynamic Inputs per Asset */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                {vaptType === 'web_app' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Kompleksitas Aplikasi</label>
                        <select
                          value={webComplexity}
                          onChange={e => setWebComplexity(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        >
                          <option value="simple">Simple (3 MD base)</option>
                          <option value="medium">Medium (5 MD base)</option>
                          <option value="complex">Complex (8 MD base)</option>
                          <option value="critical">Critical / Core Banking (12 MD base)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Endpoint API</label>
                        <input
                          type="number"
                          value={apiEndpoints}
                          onChange={e => setApiEndpoints(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Role Hak Akses</label>
                        <input
                          type="number"
                          value={userRoles}
                          onChange={e => setUserRoles(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {vaptType === 'mobile_app' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Platform</label>
                      <select
                        value={mobilePlatform}
                        onChange={e => setMobilePlatform(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      >
                        <option value="android">Android Only (1.0x)</option>
                        <option value="ios">iOS Only (1.0x)</option>
                        <option value="both">Both Android & iOS (1.7x)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Estimasi Jumlah Layar (Screens)</label>
                      <input
                        type="number"
                        value={mobileScreens}
                        onChange={e => setMobileScreens(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                {vaptType === 'network_infra' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Internal Host / IP</label>
                      <input
                        type="number"
                        value={infraHosts}
                        onChange={e => setInfraHosts(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                {vaptType === 'red_team' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Skenario Simulasi Red Team</label>
                    <select
                      value={redteamScope}
                      onChange={e => setRedteamScope(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                    >
                      <option value="assumed_breach">Assumed Breach (15 MD)</option>
                      <option value="limited">Limited Adversary Simulation (20 MD)</option>
                      <option value="standard">Standard Adversary Attack Simulation (30 MD)</option>
                      <option value="full_apt">Full-Scope Advanced Persistent Threat (45 MD)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SOC Sizing Form */
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Infrastruktur & Log Source SOC/MDR</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  EPS Sizing Engine
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Servers (35 EPS/unit)</label>
                  <input
                    type="number"
                    value={nServers}
                    onChange={e => setNServers(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Network Devices (25 EPS)</label>
                  <input
                    type="number"
                    value={nNetwork}
                    onChange={e => setNNetwork(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Endpoints/Workstations</label>
                  <input
                    type="number"
                    value={nEndpoints}
                    onChange={e => setNEndpoints(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Cloud Accounts</label>
                  <input
                    type="number"
                    value={nCloud}
                    onChange={e => setNCloud(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Intensitas Trafik</label>
                  <select
                    value={trafficIntensity}
                    onChange={e => setTrafficIntensity(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="low">Low (0.7x)</option>
                    <option value="medium">Medium (1.0x)</option>
                    <option value="high">High / Burst (1.5x)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">SLA Jam Operasional</label>
                  <select
                    value={serviceLevel}
                    onChange={e => setServiceLevel(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="8x5">8x5 Hari Kerja</option>
                    <option value="12x5">12x5 Hari Kerja</option>
                    <option value="24x7">24x7 Non-Stop Monitoring (1.5x)</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasThreatHunting}
                      onChange={e => setHasThreatHunting(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Proactive Threat Hunting</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Output Summary Card (Col 1) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Hasil Kalkulasi Scope</span>
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>

            {activeTab === 'VAPT' ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Estimasi Engineering Effort:</div>
                  <div className="text-3xl font-black text-slate-900 mt-0.5">
                    {calculatedMD} <span className="text-sm font-bold text-blue-700">Man-Days (MD)</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-blue-100 pt-3">
                  <div className="flex justify-between">
                    <span>Metodologi:</span>
                    <span className="font-semibold text-slate-900 capitalize">{boxMethod.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kepatuhan Finansial:</span>
                    <span className="font-semibold text-slate-900">{isFinancial ? '+2 MD' : 'Standard'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Baseline Alokasi Tim:</span>
                    <span className="font-semibold text-slate-900">Lead + Senior + Junior</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Estimasi Kapasitas EPS:</div>
                  <div className="text-3xl font-black text-slate-900 mt-0.5">
                    {socResult.calculated_eps.toLocaleString('id-ID')} <span className="text-sm font-bold text-blue-700">EPS</span>
                  </div>
                  <div className="mt-1 inline-block rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                    Tier: {socResult.eps_tier.toUpperCase()}
                  </div>
                </div>

                <div className="border-t border-blue-100 pt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>SLA:</span>
                    <span className="font-semibold text-slate-900">{serviceLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rekomendasi MRC:</span>
                    <span className="font-bold text-emerald-700">{formatIDR(socResult.recommended_mrc)}/bln</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer to Pricing Button */}
            <button
              onClick={handleProceedToPricing}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all mt-4"
            >
              <span>Transfer ke Dynamic Pricing</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Info className="h-4 w-4 text-slate-400" />
              <span>Ketentuan Kalkulasi</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Hasil kalkulasi scoping ini menjadi dasar pembentukan BoQ Komponen A (HR Staffing). Estimasi final tetap dapat disesuaikan oleh Pre-Sales Engineer sebelum diajukan ke otorisasi DoA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
