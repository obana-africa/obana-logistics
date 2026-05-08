"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, Truck, ArrowUpRight, Zap } from "lucide-react";
import { Loader, Button, Badge } from "@/components/ui";
import { apiClient } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { CldImage } from "next-cloudinary";

const getStatusVariant = (status: string) => {
  switch (status?.toLowerCase()) {
    case "delivered": return "success";
    case "in_transit": return "info";
    case "pending": return "warning";
    case "cancelled":
    case "returned": return "error";
    default: return "default";
  }
};

function AfricaMapGraphic() {
  return (
    <div className="relative w-[44vw] max-w-[1400] mx-auto aspect-[1.1/1]">
      <CldImage
        src="MapComponent_b88syv"
        alt="Africa logistics map"
        fill
        className="object-contain transition-transform duration-700 hover:scale-[1.02]"
        sizes="(max-width: 768px) 100vw, 80vw"
        priority
        onError={(e) => { e.currentTarget.style.opacity = "0"; }}
      />
    </div>
  );
}

export default function HeroSection() {
  const [trackingId, setTrackingId] = useState("");
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const animatedElements = document.querySelectorAll(".animate-on-scroll");
    animatedElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleTrackShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackingResult(null);
    setShowTrackingModal(true);
    try {
      const res = await apiClient.getShipment(trackingId.trim());
      if (res.success) setTrackingResult(res.data);
      else setTrackingError(res.message || "Not found");
    } catch (err: any) {
      setTrackingError(err.response?.data?.message || "Failed to fetch");
    }
    setTrackingLoading(false);
  };

  return (
    <>
      <style jsx global>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(2rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-up {
          animation: fade-up 0.7s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .animate-on-scroll {
          opacity: 0;
          transform: translateY(2rem);
          transition: none;
        }
        .animate-on-scroll.animate-fade-up {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden bg-white mt-30 lg:mt-30"
        style={{ minHeight: "92vh" }}
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-0 animate-fade-in"
          style={{
            background: "radial-gradient(circle at 10% 50% , rgba(220,251,249,0.4) 0%, transparent 70%)",
            animationDelay: "0.2s",
          }}
        />

        {/* Main grid  */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* LEFT COLUMN */}
          <div className="flex flex-col justify-center py-16 lg:py-0">
            <div className="animate-on-scroll">
              <div
                className="inline-flex items-center gap-2 self-start mb-5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase hover:scale-105 transition-transform duration-300"
                style={{ background: "#dcfbf9", color: "#1b3b5f" }}
              >
                <Zap className="w-3.5 h-3.5 text-yellow-500 animate-pulse" fill="currentColor" />
                B2B Logistics Platform
              </div>

              <h1
                className="font-black leading-[1.02] tracking-tight mb-6"
                style={{
                  color: "#1b3b5f",
                  fontSize: "clamp(2.6rem, 5.5vw, 4.25rem)",
                  fontFamily: "'Sora', 'DM Sans', sans-serif",
                }}
              >
                EV-Powered <br />
                Fulfilment for <br />
                Businesses
              </h1>

              <p
                className="text-base lg:text-lg leading-relaxed mb-8 max-w-md"
                style={{ color: "#49494D" }}
              >
                A B2B-first, tech-enabled logistics network powered by electric vehicles built for
                SME wholesale distribution across Africa.
              </p>
            </div>

            {/* Mobile map */}
            <div className="lg:hidden w-full h-64 sm:h-72 relative mt-6 mb-6 animate-on-scroll">
              <AfricaMapGraphic />
            </div>

            {/* CTA Buttons */}
            <div className=" flex flex-wrap gap-4 mb-8 animate-on-scroll">
              <Link
                href="/auth/signup"
                className="
				group inline-flex 
				items-center gap-2 
				px-7 py-3.5 rounded-xl 
				font-semibold 
				text-sm text-white 
				transition-all duration-300 
				hover:shadow-xl 
				active:scale-[0.96] 
				hover:-translate-y-0.5"
                style={{ background: "#1b3b5f" }}
              >
                Get Started
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/auth/signup"
                className="
				group 
				inline-flex 
				items-center 
				gap-2 
				px-7 
				py-3.5 
				rounded-xl 
				font-semibold 
				text-sm
				border
				border-[#1b3b5f]
   				text-[#1b3b5f]
				bg-transparent
				transition-all 
				duration-300
				ease-in-out
				hover:bg-[#020c17]
				hover:text-white 
				hover:shadow-lg 
				active:scale-[0.96] 
				hover:-translate-y-0.5"
                style={{ 
					// color: "#1b3b5f", 
					// border: "1px solid #1b3b5f", 
				}}
              >
                Create Shipment
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            {/* Track shipment form */}
            <form onSubmit={handleTrackShipment} className="flex gap-2 max-w-md animate-on-scroll">
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter tracking ID…"
                className="flex-1 px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/50 transition-all duration-200 hover:shadow-md"
                style={{ background: "#f7f8fa", borderColor: "#ecedf0", color: "#111111" }}
              />
              <button
                type="submit"
                disabled={trackingLoading}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#1b3b5f" }}
              >
                {trackingLoading ? "Tracking..." : "Track"}
              </button>
            </form>
            <p className="text-xs mt-2 transition-all duration-300 hover:translate-x-1" style={{ color: "#9A9DAF" }}>
              Real-time tracking · 24/7 support
            </p>
          </div>

          {/* RIGHT COLUMN – desktop map (safe, no overlay) */}
          <div className="hidden lg:flex justify-center items-center animate-on-scroll inset-0 pointer-events-none">
            <div className="w-full max-w-xl transform transition-transform duration-700 hover:scale-[1.02]">
              <AfricaMapGraphic />
            </div>
          </div>
        </div>
      </section>

      {/* TRACKING MODAL – same as original + smooth close on backdrop click */}
      {showTrackingModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: "fade-in 0.2s ease-out" }}
          onClick={() => setShowTrackingModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative"
            style={{ animation: "fade-up 0.3s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTrackingModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-black transition-all duration-200 hover:rotate-90"
            >
              <X className="w-6 h-6" />
            </button>

            {trackingLoading ? (
              <div className="flex justify-center py-12"><Loader className="animate-spin" /></div>
            ) : trackingError ? (
              <div className="text-center py-8">
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4" style={{ animation: "shake 0.3s ease-in-out" }}>
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Tracking Failed</h3>
                <p className="text-red-600 mb-6">{trackingError}</p>
                <Button variant="secondary" className="w-full transition-all duration-200 hover:scale-[1.02]" onClick={() => setShowTrackingModal(false)}>Close</Button>
              </div>
            ) : trackingResult ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Shipment Reference</p>
                    <h3 className="text-lg font-bold" style={{ color: "#1b3b5f" }}>{trackingResult.shipment_reference}</h3>
                  </div>
                  <Badge variant={getStatusVariant(trackingResult.status)}>
                    {trackingResult.status?.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center mb-1" style={{ color: "#9A9DAF" }}>
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="text-xs font-medium uppercase">Origin</span>
                    </div>
                    <p className="font-medium" style={{ color: "#1b3b5f" }}>
                      {trackingResult.pickup_address?.city}, {trackingResult.pickup_address?.state}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center mb-1" style={{ color: "#9A9DAF" }}>
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="text-xs font-medium uppercase">Destination</span>
                    </div>
                    <p className="font-medium" style={{ color: "#1b3b5f" }}>
                      {trackingResult.delivery_address?.city}, {trackingResult.delivery_address?.state}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl p-4 space-y-2" style={{ background: "#f7f8fa" }}>
                  {[
                    ["Service Level", trackingResult.service_level],
                    ["Transport Mode", trackingResult.transport_mode],
                    ["Total Items", trackingResult.total_items],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span style={{ color: "#9A9DAF" }}>{label}</span>
                      <span className="font-medium capitalize" style={{ color: "#1b3b5f" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {trackingResult.tracking_events?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-4 flex items-center" style={{ color: "#1b3b5f" }}>
                      <Truck className="w-4 h-4 mr-2" />
                      Tracking History
                    </h4>
                    <div className="relative border-l-2 ml-2 pl-6 py-2 max-h-60 overflow-y-auto" style={{ borderColor: "#ecedf0" }}>
                      {trackingResult.tracking_events
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((event: any, index: number) => (
                          <div key={event.id} className="relative mb-6 last:mb-0 group">
                            <div
                              className="absolute left-[-1.85rem] top-1.5 w-3 h-3 rounded-full border-2 border-white transition-all duration-300 group-hover:scale-125"
                              style={{
                                background: index === 0 ? "#1b3b5f" : "#B8B4B480",
                                outline: index === 0 ? "3px solid #dcfbf9" : "none",
                                outlineOffset: "1px",
                              }}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold" style={{ color: "#1b3b5f" }}>
                                {event.status.replace("_", " ").toUpperCase()}
                              </span>
                              <span className="text-xs mb-1" style={{ color: "#9A9DAF" }}>
                                {new Date(event.createdAt).toLocaleString()}
                              </span>
                              {event.description && (
                                <span className="text-sm" style={{ color: "#49494D" }}>{event.description}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <Button
                  variant="secondary"
                  className="w-full transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => { setShowTrackingModal(false); setTrackingResult(null); setTrackingId(""); }}
                >
                  Track Another Shipment
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}