"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowRight, UserCircle2, MapPin, CheckCheck } from "lucide-react";

const stepsData = [
	{
    id: 1,
    number: "01",
    title: "Create a shipment",
    shortDescription: "Tell us what you're shipping, where it's going, and when it needs to arrive.",
    expandedDescription:
      "Tell us what you're shipping, where it's going, and when it needs to arrive. Enter pickup and drop-off locations, package dimensions, weight, and any special handling instructions. Choose from standard, express, or same-day delivery options.",
    ctaLabel: "Get Started",
    ctaHref: "/auth/signup",
  },
  {
    id: 2,
    number: "02",
    icon: UserCircle2,
    title: "Get matched with a driver",
    shortDescription: "Our system connects you with the right driver for the job.",
    expandedDescription:
      "Our intelligent matching algorithm instantly pairs your shipment with the best available driver based on location, vehicle type, rating, and real-time availability. You'll receive driver details and an ETA within seconds.",
	  ctaLabel: "Get Started",
	  ctaHref: "/auth/signup",
  },
  {
    id: 3,
    number: "03",
    icon: MapPin,
    title: "Track delivery in real time",
    shortDescription: "Follow your shipment live, from pickup to drop-off.",
    expandedDescription:
      "Get live GPS tracking, automated status notifications, and estimated arrival times. Share tracking links with your customers. Our heatmap shows exactly where your goods are at every moment.",
	  ctaLabel: "Get Started",
	  ctaHref: "/auth/signup",
  },
  {
    id: 4,
    number: "04",
    icon: CheckCheck,
    title: "Confirm completion",
    shortDescription: "Review and confirm — then pay securely.",
    expandedDescription:
      "Review proof of delivery, rate your driver, and release payment instantly via our secure escrow system. Digital receipts and analytics are saved to your dashboard for all future shipments.",
	  ctaLabel: "Get Started",
	  ctaHref: "/auth/signup",
  },
];

const CARD_HEIGHT = "380px";

// ─── Scroll visibility hook ───────────────────────────────────────────────────
function useVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function UniversalCard({
  step,
  delay,
}: {
  step: (typeof stepsData)[0];
  delay: number;
}) {
  const { ref, visible } = useVisible();
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = step.icon;

  const handleClick = () => setIsExpanded(true);
  const handleMouseEnter = () => setIsExpanded(true);
  const handleMouseLeave = () => setIsExpanded(false);
  const handleFocus = () => setIsExpanded(true);
  const handleBlur = () => setIsExpanded(false);

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
      tabIndex={0}
      className="relative rounded-3xl p-6 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1b3b5f] focus:ring-offset-2"
      style={{
        height: CARD_HEIGHT,
        border: isExpanded ? "1.5px solid #1b3b5f" : "1.5px solid #ecedf0",
        background: isExpanded ? "#1b3b5f" : "#ffffff",
        boxShadow: isExpanded
          ? "0 12px 32px rgba(27,59,95,0.12)"
          : "0 4px 12px rgba(27,59,95,0.04)",
        opacity: visible ? 1 : 0,
        transform: visible ? (isExpanded ? "translateY(-4px)" : "translateY(0)") : "translateY(28px)",
        transition: `opacity 0.1s ease ${delay}s, transform 0.55s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease`,
      }}
    >
      {/* Watermark number */}
      <span
        className="absolute top-4 right-6 font-black select-none pointer-events-none"
        style={{
          fontSize: "6rem",
          lineHeight: 1,
          color: isExpanded ? "rgba(255,255,255,0.06)" : "rgba(27,59,95,0.04)",
          fontFamily: "'Sora', 'DM Sans', sans-serif",
          transition: "color 0.3s ease",
        }}
      >
        {step.number}
      </span>

      {/* Icon section */}
      {Icon && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="relative flex items-center justify-center rounded-2xl shrink-0"
            style={{
              width: "68px",
              height: "68px",
              background: isExpanded ? "#1b3b5f" : "#f0f4f8",
              transition: "background 0.3s ease",
            }}
          >
            <Icon
              className="w-7 h-7"
              style={{
                color: isExpanded ? "#ffffff" : "#1b3b5f",
                transition: "color 0.3s ease",
              }}
              strokeWidth={1.5}
            />
          </div>
        </div>
      )}

      {!Icon && <div className="flex-1" />}

      {/* Content area with CTA button */}
      <div className="mt-auto pt-4">
        <h4
          className="font-bold mb-2"
          style={{
            color: "#1b3b5f",
            fontSize: "1rem",
            fontFamily: "'Sora', 'DM Sans', sans-serif",
            ...(isExpanded && { color: "#f59e0b" }),
          }}
        >
          {step.title}
        </h4>

        {isExpanded ? (
          <>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.68)" }}>
              {step.expandedDescription}
            </p>
            <a
              href={step.ctaHref}
              className="inline-flex items-center gap-2 text-sm font-semibold group/cta transition-all duration-200"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {step.ctaLabel}
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-1" />
            </a>
          </>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#49494D" }}>
            {step.shortDescription}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function HowItWorks() {
  const { ref: headingRef, visible: headingVisible } = useVisible(0.2);

  return (
    <section className="py-24 pt-8 lg:pt-24 pb-24 relative overflow-hidden mt-0" style={{ background: "#ffffff" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(220,251,249,0.45) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <div
          ref={headingRef}
          className="text-center mb-16"
          style={{
            opacity: headingVisible ? 1 : 0,
            transform: headingVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <h2
            className="font-black tracking-tight mb-5"
            style={{
              color: "#1b3b5f",
              fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
              fontFamily: "'Sora', 'DM Sans', sans-serif",
              lineHeight: 1.08,
            }}
          >
            How it Works
          </h2>
          <p
            className="text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: "#49494D" }}
          >
            From creation to completion — post your shipment, get matched instantly, and track every mile until it's delivered.
          </p>
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          

          {stepsData.map((step, i) => (
            <div key={step.id} className="relative">
              {/* Dashed connector line */}
              {i < stepsData.length - 1 && (
                <div
                  className="absolute hidden lg:block"
                  style={{
                    height: "2px",
                    top: "34px",
                    left: "calc(100% + 4px)",
                    width: "calc(100% - 68px)",
                    backgroundImage: `repeating-linear-gradient(90deg, rgba(27,59,95,0.25) 0, rgba(27,59,95,0.25) 6px, transparent 6px, transparent 14px)`,
                    zIndex: 0,
                  }}
                />
              )}
              <UniversalCard step={step} delay={0.1 + i * 0.12} />
            </div>
          ))}
        </div>

        {/* Mobile dots */}
        <div className="flex sm:hidden justify-center gap-3 mt-10">
          {stepsData.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i === 0 ? "#1b3b5f" : "#B8B4B4" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}