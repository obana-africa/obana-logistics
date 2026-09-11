"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import TrackingModal from "@/components/home/TrackingModal";
import { cld } from "@/lib/site";
/* eslint-disable @next/next/no-img-element -- Cloudinary sizes these images per screen via cld(). */

function AfricaMapGraphic() {
  return (
    <div className="relative w-[44vw] max-w-[1400] ml-0 lg:ml-auto aspect-[1.1/1]">
      {/* ~1100px WebP/AVIF from Cloudinary instead of the 2 MB original. */}
      <img
        src={cld("MapComponent_b88syv", 1100)}
        alt="Africa logistics map"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 hover:scale-[1.02]"
      />
    </div>
  );
}

export default function HeroSection() {
  const [trackingId, setTrackingId] = useState("");
  const [lookupReference, setLookupReference] = useState<string>();
  const [trackingOpen, setTrackingOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const animatedElements = document.querySelectorAll(".animate-on-scroll");
    const reveal = (el: Element) => el.classList.add("animate-fade-up");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    animatedElements.forEach((el) => observer.observe(el));
    // Safety net: the hero is always on screen at load, so never leave it hidden.
    const fallback = window.setTimeout(() => animatedElements.forEach(reveal), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const handleTrackShipment = (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackingId.trim();
    if (!id) return;
    setLookupReference(id);
    setTrackingOpen(true);
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
        .animate-fade-up {
          animation: fade-up 0.7s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
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
        @media (prefers-reduced-motion: reduce) {
          .animate-on-scroll { opacity: 1; transform: none; }
        }
      `}</style>

      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden bg-white mt-28 lg:mt-30 min-h-[50vh] lg:min-h-[92vh] pb-4 lg:pb-0"
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
          <div className="flex flex-col justify-center py-8 pb-4 lg:py-0">
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
                  fontFamily: "var(--font-display)",
                }}
              >
                EV-Powered <br />
                Fulfilment for <br />
                Businesses
              </h1>

              <p className="text-base lg:text-lg leading-relaxed mb-8 max-w-md" style={{ color: "#49494D" }}>
                A B2B-first, tech-enabled logistics network powered by electric vehicles built for
                SME wholesale distribution across Africa.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-8 animate-on-scroll">
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:shadow-xl active:scale-[0.96] hover:-translate-y-0.5"
                style={{ background: "#1b3b5f" }}
              >
                Get Started
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm border border-[#1b3b5f] text-[#1b3b5f] bg-transparent transition-all duration-300 ease-in-out hover:bg-[#020c17] hover:text-white hover:shadow-lg active:scale-[0.96] hover:-translate-y-0.5"
              >
                Create Shipment
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            {/* Track shipment form */}
            <form id="track" onSubmit={handleTrackShipment} className="flex gap-2 max-w-md animate-on-scroll">
              <label htmlFor="hero-tracking-id" className="sr-only">
                Tracking ID
              </label>
              <input
                id="hero-tracking-id"
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter tracking ID…"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 px-4 py-3 rounded-xl text-base sm:text-sm border focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/50 transition-all duration-200 hover:shadow-md"
                style={{ background: "#f7f8fa", borderColor: "#ecedf0", color: "#111111" }}
              />
              <button
                type="submit"
                disabled={!trackingId.trim()}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#1b3b5f" }}
              >
                Track
              </button>
            </form>
            <p className="text-xs mt-2 mb-0" style={{ color: "#9A9DAF" }}>
              Real-time tracking · 24/7 support
            </p>
          </div>

          {/* RIGHT COLUMN – desktop map */}
          <div className="hidden lg:flex justify-start items-center animate-on-scroll inset-0 pointer-events-none">
            <div className="w-full max-w-xl transform transition-transform duration-700 hover:scale-[1.02]">
              <AfricaMapGraphic />
            </div>
          </div>
        </div>
      </section>

      <TrackingModal open={trackingOpen} onClose={() => setTrackingOpen(false)} reference={lookupReference} />
    </>
  );
}
