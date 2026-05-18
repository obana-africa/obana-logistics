// "use client";

// import React, { useState } from "react";
// import { useAuth } from "@/lib/authContext";
// import { useRouter } from "next/navigation";
// import { Button, Input, Card, Alert } from "@/components/ui";
// import { Mail, Lock, Package, Truck, EyeOff, Eye } from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";

// export default function LoginPage() {
// 	const router = useRouter();
// 	const { login, error, clearError } = useAuth();
// 	const [loading, setLoading] = useState(false);
// 	const [showPassword, setShowPassword] = useState(false);
// 	const [formData, setFormData] = useState({
// 		userIdentification: "",
// 		password: "",
// 		rememberMe: false,
// 	});

// 	const handleSubmit = async (e: React.FormEvent) => {
// 		e.preventDefault();
// 		clearError();
// 		setLoading(true);

// 		try {
// 			const response = await login(
// 				formData.userIdentification,
// 				formData.password,
// 				formData.rememberMe
// 			);
// 			type RoleType = 'customer' | 'driver' | 'admin' | 'agent';


// 			const roleRoutes: Record<RoleType, string> = {
// 			    customer: '/dashboard/customer',
// 			    driver: '/dashboard/driver',
// 			    admin: '/dashboard/admin',
// 			    agent: '/dashboard/agent',
// 			};
			
// 			const role = response.data.user.role as RoleType;
// 			const route = roleRoutes[role]; 
// 			router.replace(
// 					role
// 					? route || '/'
// 					: '/'
// 			);
// 		} catch (err) {
// 			console.error(err);
// 		} finally {
// 			setLoading(false);
// 		}
// 	};

// 	return (
// 		<div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
// 			{/* Animated background elements */}
// 			<div className="absolute inset-0 overflow-hidden pointer-events-none">
// 				<div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
// 				<div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
// 				<Package className="absolute top-1/4 right-1/4 w-16 h-16 text-white/5 animate-float" />
// 				<Truck className="absolute bottom-1/3 left-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
// 			</div>

// 			<div className="w-full max-w-md relative z-10">
// 				{/* Login Card */}
// 				<Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
// 					<div className="mb-6">
// 						<div className="text-center mb-8">
// 							<Link
// 								href="/"
// 								className="flex items-center justify-center bg-[#f4f4f4] rounded-lg "
// 							>
// 								<Image
// 									src="/logo.svg"
// 									alt="Obana Logistics Logo"
// 									width={100}
// 									height={100}
// 									className="ml-2"
// 								/>
// 							</Link>
// 							<p className="text-[#1B3E5D] text-lg font-medium">
// 								Logistics Made Simple
// 							</p>
// 						</div>
// 						<h2 className="text-2xl font-bold text-gray-900 mb-2">
// 							Welcome Back
// 						</h2>
// 						<p className="text-gray-600">Sign in to access your dashboard</p>
// 					</div>

// 					{error && (
// 						<Alert
// 							type="error"
// 							className="mb-6 cursor-pointer bg-red-50 border-red-200"
// 							onClick={clearError}
// 						>
// 							{error}
// 						</Alert>
// 					)}

// 					<form onSubmit={handleSubmit} className="space-y-5">
// 						<Input
// 							label="Email or Phone Number"
// 							type="text"
// 							placeholder="you@example.com or +234..."
// 							required
// 							value={formData.userIdentification}
// 							onChange={(e) =>
// 								setFormData({ ...formData, userIdentification: e.target.value })
// 							}
// 							icon={<Mail className="w-5 h-5 text-gray-400" />}
// 						/>

// 						<div className="relative">
// 							<Input
// 								label="Password"
// 								type={showPassword ? "text" : "password"}
// 								placeholder="Enter your password"
// 								required
// 								value={formData.password}
// 								onChange={(e) =>
// 									setFormData({ ...formData, password: e.target.value })
// 								}
// 								icon={<Lock className="w-5 h-5 text-gray-400" />}
// 								className="pr-10" // important: padding-right to make space for eye
// 							/>
// 							<button
// 								type="button"
// 								onClick={() => setShowPassword(!showPassword)}
// 								className="absolute right-3 top-12.5 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
// 							>
// 								{showPassword ? (
// 									<EyeOff className="w-5 h-5" />
// 								) : (
// 									<Eye className="w-5 h-5" />
// 								)}
// 							</button>
// 						</div>

// 						<div className="flex items-center justify-between">
// 							<div className="flex items-center">
// 								<input
// 									type="checkbox"
// 									id="remember"
// 									checked={formData.rememberMe}
// 									onChange={(e) =>
// 										setFormData({ ...formData, rememberMe: e.target.checked })
// 									}
// 									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
// 								/>
// 								<label
// 									htmlFor="remember"
// 									className="ml-2 text-sm text-gray-700 font-medium"
// 								>
// 									Remember me
// 								</label>
// 							</div>
// 							<Link
// 								href="/auth/forgot-password"
// 								className="text-sm text-[#1B3E5D] hover:text-blue-700 font-semibold hover:underline"
// 							>
// 								Forgot password?
// 							</Link>
// 						</div>

// 						<Button
// 							type="submit"
// 							loading={loading}
// 							fullWidth
// 							variant="primary"
// 							className="h-12 text-base font-semibold bg-[#1B3E5D] shadow-lg cursor-pointer"
// 						>
// 							Sign In
// 						</Button>
// 					</form>

// 					<div className="mt-8 pt-6 border-t border-gray-200 text-center">
// 						<p className="text-gray-600">
// 							Don&apos;t have an account?{" "}
// 							<a
// 								href="/auth/signup"
// 								className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
// 							>
// 								Create Account
// 							</a>
// 						</p>
// 					</div>
// 				</Card>

// 				{/* Trust Indicators */}
// 				<div className="mt-8 text-center">
// 					<p className="text-blue-200 text-sm mb-3">
// 						Trusted by businesses across Nigeria
// 					</p>
// 					<div className="flex items-center justify-center space-x-6 text-white/60">
// 						<div className="flex items-center space-x-2">
// 							<Package className="w-4 h-4" />
// 							<span className="text-xs">10k+ Deliveries</span>
// 						</div>
// 						<div className="flex items-center space-x-2">
// 							<Truck className="w-4 h-4" />
// 							<span className="text-xs">500+ Drivers</span>
// 						</div>
// 					</div>
// 				</div>
// 			</div>

// 			<style jsx>{`
// 				@keyframes float {
// 					0%,
// 					100% {
// 						transform: translateY(0px);
// 					}
// 					50% {
// 						transform: translateY(-20px);
// 					}
// 				}
// 				@keyframes float-delayed {
// 					0%,
// 					100% {
// 						transform: translateY(0px);
// 					}
// 					50% {
// 						transform: translateY(-15px);
// 					}
// 				}
// 				.animate-float {
// 					animation: float 6s ease-in-out infinite;
// 				}
// 				.animate-float-delayed {
// 					animation: float-delayed 8s ease-in-out infinite;
// 				}
// 			`}</style>
// 		</div>
// 	);
// }


"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Alert } from "@/components/ui";
import { Mail, Lock, Package, Truck, EyeOff, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    userIdentification: "",
    password: "",
    rememberMe: false,
  });

  /* ── All original logic untouched ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      const response = await login(
        formData.userIdentification,
        formData.password,
        formData.rememberMe
      );
      type RoleType = "customer" | "driver" | "admin" | "agent";

      const roleRoutes: Record<RoleType, string> = {
        customer: "/dashboard/customer",
        driver: "/dashboard/driver",
        admin: "/dashboard/admin",
        agent: "/dashboard/agent",
      };

      const role = response.data.user.role as RoleType;
      const route = roleRoutes[role];
      router.replace(role ? route || "/" : "/");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-20px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-15px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-float         { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; }
        .pill-1 { animation: fadeSlideUp 0.7s ease 0.3s forwards; opacity: 0; }
        .pill-2 { animation: fadeSlideUp 0.7s ease 0.6s forwards; opacity: 0; }
        .pill-3 { animation: fadeSlideUp 0.7s ease 0.9s forwards; opacity: 0; }

        /* Shared font for form panel */
        .login-form-panel { font-family: 'DM Sans', sans-serif; }

        /* Smaller, muted placeholders */
        .login-form-panel input::placeholder,
        .login-form-panel textarea::placeholder {
          font-size: 12.5px;
          color: #b0b7c3;
          font-family: 'DM Sans', sans-serif;
        }

        /* Sign In button — slick lift + glow hover */
        .btn-signin {
          position: relative;
          overflow: hidden;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.25s ease,
                      background-color 0.2s ease;
        }
        .btn-signin:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 28px rgba(27,62,93,0.45);
          background-color: #16324d;
        }
        .btn-signin:active:not(:disabled) {
          transform: translateY(0px) scale(0.99);
          box-shadow: 0 3px 10px rgba(27,62,93,0.3);
        }

        /* Create account button — smooth border + bg reveal */
        .btn-create-account {
          transition: border-color 0.25s ease,
                      background-color 0.25s ease,
                      color 0.25s ease,
                      transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.25s ease;
        }
        .btn-create-account:hover {
          border-color: #1B3E5D;
          background-color: #1B3E5D;
          color: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(27,62,93,0.3);
        }
        .btn-create-account:active {
          transform: translateY(0px);
        }

        /* Prevent layout shift while typing in inputs */
        .login-form-panel form { will-change: auto; }
        .login-form-panel input,
        .login-form-panel input:focus,
        .login-form-panel input:active {
          transform: none !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          will-change: auto;
          contain: layout style;
        }
        /* Lock every direct wrapper div around inputs to a fixed height */
        .login-form-panel .input-stable {
          position: relative;
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        /* Stop any parent flex/grid from resizing on content change */
        .login-form-panel .space-y-5 > * {
          flex-shrink: 0;
          contain: layout;
        }
      ` }} />

      {/* Full-page background */}
      <div
        className="min-h-screen flex items-center justify-center relative overflow-auto"
        style={{
          backgroundImage: "url('/loginBg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          padding: "16px",
        }}
      >
        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Ambient icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Package className="absolute top-1/4 left-1/4 w-16 h-16 text-white/5 animate-float" />
          <Truck className="absolute bottom-1/3 right-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
        </div>

        {/* ══ SPLIT CARD ══
            Mobile  → flex-col  (image banner on top, form below)
            Desktop → flex-row  (image left 50%, form right 50%)
        */}
        <div
          className="relative z-10 w-full flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
          style={{ maxWidth: "1000px" }}
        >
          {/* ── IMAGE PANEL ────────────────────────────────
              Mobile  → 220px tall banner across full width
              Desktop → left half, full card height
          ─────────────────────────────────────────────── */}
          <div
            className="relative flex-shrink-0"
            style={{
              /* Mobile: fixed banner height | Desktop: 50% width */
              height: undefined,
            }}
          >
            {/* Responsive height via a sibling padding trick */}
            <div
              className="md:hidden"
              style={{ height: "220px", position: "relative" }}
            >
              <Image
                src="/loginBg.jpg"
                alt="Obana Logistics"
                fill
                priority
                quality={75}
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover object-center"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(10,20,40,0.78) 0%, rgba(10,20,40,0.25) 50%, rgba(10,20,40,0.82) 100%)",
                }}
              />
              {/* Mobile overlay content */}
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                {/* Logo row */}
                <div className="flex items-center gap-3">
                  <Link href="/">
                    <div className="w-24 h-24 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center overflow-hidden">
                      <Image 
					  src="/logo.svg" alt="Obana" 
					  width={94} height={64} 
					  style={{height:"auto"}}
					   />
                    </div>
                  </Link>
                  <div>
                    <p className="text-white text-sm font-extrabold leading-tight">Obana Logistics</p>
                    <p className="text-white/55 text-[9px] font-semibold uppercase tracking-widest">Logistics Made Simple</p>
                  </div>
                </div>
                {/* Bottom pills row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-1.5">
                    <Package className="w-3 h-3 text-white" />
                    <span className="text-white text-xs font-bold">Lagos, Nigeria</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 rounded-full px-3 py-1.5">
                    <Truck className="w-3 h-3 text-[#1B3E5D]" />
                    <span className="text-[#1B3E5D] text-xs font-bold">500+ Drivers</span>
                  </div>
                  <div className="flex flex-col bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-1.5">
                    <span className="text-white text-sm font-extrabold leading-none">10k+</span>
                    <span className="text-white/60 text-[9px]">Deliveries</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop image panel — hidden on mobile */}
            <div
              className="hidden md:block"
              style={{ position: "relative", width: "500px", height: "100%" }}
            >
              <div style={{ position: "absolute", inset: 0 }}>
                <Image
                  src="/loginBg.jpg"
                  alt="Obana Logistics"
                  fill
                  priority
                  quality={75}
                 sizes="(max-width: 768px) 0vw, 500px"
                  className="object-cover object-center"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(10,20,40,0.72) 0%, rgba(10,20,40,0.20) 40%, rgba(10,20,40,0.80) 100%)",
                  }}
                />
                <div className="absolute inset-0 flex flex-col justify-between p-8">
                  {/* TOP — Logo + name */}
                  <div className="pill-1 flex flex-col items-start gap-3">
                    <Link href="/">
                      <div className="w-24 h-24  backdrop-blur-md rounded hover:bg-white/25  flex items-center justify-center overflow-hidden transition-colors">
                        <Image 
						src="/white-logo.svg" 
						alt="Obana Logistics" 
						width={94} height={64} 
						style={{height:"auto"}}
						 />
                      </div>
                    </Link>
                    <div className="mt-1">
                      <p className="text-white text-xl font-extrabold leading-tight tracking-tight">Obana Logistics</p>
                      <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mt-1">Logistics Made Simple</p>
                    </div>
                  </div>
                  {/* MIDDLE — 10k pill */}
                  <div className="pill-2 self-end flex flex-col bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-5 py-4">
                    <p className="text-white text-2xl font-extrabold leading-none">10k+</p>
                    <p className="text-white/65 text-xs font-medium mt-1 leading-snug">Successful<br />Deliveries</p>
                  </div>
                  {/* BOTTOM — destination + drivers */}
                  <div className="flex flex-col items-start gap-3">
                    <div className="pill-3 flex items-center gap-3 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-3">
                      <div className="w-8 h-8 rounded-xl bg-[#1B3E5D] flex items-center justify-center flex-shrink-0">
                        <Package className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-white/55 text-[10px] font-semibold uppercase tracking-wider leading-none mb-0.5">Delivering to</p>
                        <p className="text-white text-sm font-bold leading-none">Lagos, Nigeria</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-5 py-2.5 shadow-lg">
                      <Truck className="w-4 h-4 text-[#1B3E5D]" />
                      <span className="text-[#1B3E5D] text-sm font-bold">500+ Active Drivers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM PANEL ─────────────────────────────────
              Mobile  → full width, below image banner
              Desktop → right half (flex-1 fills remaining space)
          ─────────────────────────────────────────────── */}
          <div
            className="login-form-panel flex flex-col justify-between bg-white w-full"
            style={{
              flex: 1,
              padding: "clamp(28px, 5vw, 44px) clamp(20px, 5vw, 48px)",
            }}
          >
            {/* ── MIDDLE: Heading + form ── */}
            <div className="flex-1 flex flex-col justify-center" style={{ contain: "layout" }}>
              {/* Heading block */}
              <div className="mb-8">
                <h2
                  className="text-[28px] font-extrabold leading-tight mb-1.5"
                  style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Welcome Back 
                </h2>
                <p className="text-gray-400 text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Sign in to continue to your dashboard
                </p>
              </div>

              {/* Error alert */}
              {error && (
                <Alert
                  type="error"
                  className="mb-5 cursor-pointer bg-red-50 border-red-200 rounded-xl text-sm"
                  onClick={clearError}
                >
                  {error}
                </Alert>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5" style={{ isolation: "isolate" }}>

                {/* Email field */}
                <div style={{ display: "block" }}>
                  <label
                    htmlFor="userIdentification"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "6px",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Email or Phone Number
                  </label>
                  <div style={{ position: "relative", height: "44px" }}>
                    <span style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      zIndex: 1,
                    }}>
                      <Mail className="w-5 h-5 text-gray-400" />
                    </span>
                    <input
                      id="userIdentification"
                      type="text"
                      placeholder="you@example.com or +234..."
                      required
                      value={formData.userIdentification}
                      onChange={(e) =>
                        setFormData({ ...formData, userIdentification: e.target.value })
                      }
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        boxSizing: "border-box",
                        paddingLeft: "40px",
                        paddingRight: "14px",
                        fontSize: "14px",
                        fontFamily: "'DM Sans', sans-serif",
                        color: "#111827",
                        background: "#F9FAFB",
                        border: "1.5px solid #E5E7EB",
                        borderRadius: "10px",
                        outline: "none",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#1B3E5D"
                        e.target.style.boxShadow = "0 0 0 3px rgba(27,62,93,0.08)"
                        e.target.style.background = "#fff"
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#E5E7EB"
                        e.target.style.boxShadow = "none"
                        e.target.style.background = "#F9FAFB"
                      }}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div style={{ display: "block" }}>
                  <label
                    htmlFor="password"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "6px",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: "relative", height: "44px" }}>
                    <span style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      zIndex: 1,
                    }}>
                      <Lock className="w-5 h-5 text-gray-400" />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        boxSizing: "border-box",
                        paddingLeft: "40px",
                        paddingRight: "44px",
                        fontSize: "14px",
                        fontFamily: "'DM Sans', sans-serif",
                        color: "#111827",
                        background: "#F9FAFB",
                        border: "1.5px solid #E5E7EB",
                        borderRadius: "10px",
                        outline: "none",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#1B3E5D"
                        e.target.style.boxShadow = "0 0 0 3px rgba(27,62,93,0.08)"
                        e.target.style.background = "#fff"
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#E5E7EB"
                        e.target.style.boxShadow = "none"
                        e.target.style.background = "#F9FAFB"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        color: "#9CA3AF",
                        zIndex: 1,
                      }}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                  <label htmlFor="remember" className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={formData.rememberMe}
                      onChange={(e) =>
                        setFormData({ ...formData, rememberMe: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#1B3E5D] border-gray-300 rounded focus:ring-2 focus:ring-[#1B3E5D] focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-600 font-medium group-hover:text-gray-800 transition-colors">
                      Remember me
                    </span>
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="link-forgot text-sm text-[#1B3E5D] font-semibold"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* CTA button */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    loading={loading}
                    fullWidth
                    variant="primary"
                    className="btn-signin h-12 text-sm font-bold bg-[#1B3E5D] shadow-md cursor-pointer rounded-xl tracking-wide"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Sign In
                  </Button>
                </div>
              </form>
            </div>

            {/* ── BOTTOM: Divider + sign-up ── */}
            <div className="mt-6 md:mt-8">

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-gray-400 text-xs font-medium">New to Obana?</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Sign-up CTA */}
              <a
                href="/auth/signup"
                className="btn-create-account flex items-center justify-center w-full h-11 rounded-xl border-2 border-[#1B3E5D]/20 text-[#1B3E5D] text-sm font-bold"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Create an Account
              </a>

              {/* Mobile trust line */}
              <p className="mt-4 text-center text-gray-300 text-xs md:hidden">
                Trusted across Nigeria · 10k+ Deliveries · 500+ Drivers
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}