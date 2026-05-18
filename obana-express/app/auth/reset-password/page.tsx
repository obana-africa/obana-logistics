// "use client"
// import React, { useState, Suspense } from "react";
// import { Button, Input, Card, Alert } from "@/components/ui";
// import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";
// import { useSearchParams, useRouter } from "next/navigation";

// function ResetPasswordForm() {
//     const searchParams = useSearchParams();
//     const router = useRouter();
//     const token = searchParams.get("token");

//     const [loading, setLoading] = useState(false);
//     const [success, setSuccess] = useState(false);
//     const [error, setError] = useState("");
    
//     const [password, setPassword] = useState("");
//     const [confirmPassword, setConfirmPassword] = useState("");
//     const [showPassword, setShowPassword] = useState(false);
//     const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault();
//         setError("");

//         if (password !== confirmPassword) {
//             setError("Passwords do not match");
//             return;
//         }

//         if (!token) {
//             setError("Invalid or missing reset token. Please request a new link.");
//             return;
//         }

//         setLoading(true);

//         try {
//             const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/users/reset-password-confirm`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ token, password })
//             });

//             const data = await response.json();

//             if (!response.ok) {
//                 throw new Error(data.message || 'Failed to reset password');
//             }

//             setSuccess(true);
//         } catch (err: any) {
//             setError(err.message || "An error occurred");
//         } finally {
//             setLoading(false);
//         }
//     };

//     if (success) {
//         return (
//             <div className="text-center py-6">
//                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                     <CheckCircle className="w-8 h-8 text-green-600" />
//                 </div>
//                 <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Reset Successful</h3>
//                 <p className="text-gray-600 mb-6">
//                     Your password has been updated. You can now log in with your new password.
//                 </p>
//                 <Link href="/auth/login">
//                     <Button fullWidth variant="primary">
//                         Go to Login
//                     </Button>
//                 </Link>
//             </div>
//         );
//     }

//     return (
//         <form onSubmit={handleSubmit} className="space-y-6">
//             {!token && (
//                  <Alert type="error">Missing reset token. Please check your email link.</Alert>
//             )}
            
//             {error && (
//                 <Alert type="error" onClick={() => setError("")}>
//                     {error}
//                 </Alert>
//             )}

//             <div className="relative">
//                 <Input
//                     label="New Password"
//                     type={showPassword ? "text" : "password"}
//                     placeholder="Enter new password"
//                     required
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     icon={<Lock className="w-5 h-5 text-gray-400" />}
//                     className="pr-10"
//                 />
//                 <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute right-3 top-10.5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                 >
//                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
//                 </button>
//             </div>

//             <div className="relative">
//                 <Input
//                     label="Confirm Password"
//                     type={showConfirmPassword ? "text" : "password"}
//                     placeholder="Confirm new password"
//                     required
//                     value={confirmPassword}
//                     onChange={(e) => setConfirmPassword(e.target.value)}
//                     icon={<Lock className="w-5 h-5 text-gray-400" />}
//                     className="pr-10"
//                 />
//                 <button
//                     type="button"
//                     onClick={() => setShowConfirmPassword(!showConfirmPassword)}
//                     className="absolute right-3 top-10.5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                 >
//                     {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
//                 </button>
//             </div>

//             <Button type="submit" loading={loading} fullWidth variant="primary" disabled={!token}>
//                 Set New Password
//             </Button>
//         </form>
//     );
// }

// export default function ResetPasswordPage() {
//     return (
//         <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
//             <div className="w-full max-w-md">
//                 <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
//                     <div className="mb-6 text-center">
//                         <Link href="/" className="inline-block bg-[#f4f4f4] rounded-lg mb-4">
//                             <Image src="/logo.svg" alt="Obana Logistics Logo" width={100} height={100} className="ml-2" />
//                         </Link>
//                         <h2 className="text-2xl font-bold text-gray-900">Create New Password</h2>
//                     </div>
//                     <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
//                         <ResetPasswordForm />
//                     </Suspense>
//                 </Card>
//             </div>
//         </div>
//     );
// }

"use client";

import React, { useState, Suspense } from "react";
import { Button, Alert } from "@/components/ui";
import { Lock, Eye, EyeOff, CheckCircle, Package, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/* ── All original logic untouched ── */
function ResetPasswordForm() {
  const searchParams    = useSearchParams();
  const token           = searchParams.get("token");

  const [loading,             setLoading]             = useState(false);
  const [success,             setSuccess]             = useState(false);
  const [error,               setError]               = useState("");
  const [password,            setPassword]            = useState("");
  const [confirmPassword,     setConfirmPassword]     = useState("");
  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token. Please request a new link.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/users/reset-password-confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to reset password");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared input focus/blur handlers ── */
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#1B3E5D";
    e.target.style.boxShadow   = "0 0 0 3px rgba(27,62,93,0.08)";
    e.target.style.background  = "#fff";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#E5E7EB";
    e.target.style.boxShadow   = "none";
    e.target.style.background  = "#F9FAFB";
  };

  /* ── Shared styles ── */
  const inputWrapStyle: React.CSSProperties = {
    position: "relative", height: "44px",
  };
  const inputStyle: React.CSSProperties = {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    boxSizing: "border-box",
    paddingLeft: "40px", paddingRight: "44px",
    fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
    color: "#111827", background: "#F9FAFB",
    border: "1.5px solid #E5E7EB", borderRadius: "10px",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };
  const iconStyle: React.CSSProperties = {
    position: "absolute", left: "12px", top: "50%",
    transform: "translateY(-50%)", pointerEvents: "none",
    display: "flex", alignItems: "center", zIndex: 1,
  };
  const eyeStyle: React.CSSProperties = {
    position: "absolute", right: "12px", top: "50%",
    transform: "translateY(-50%)", zIndex: 1,
    background: "none", border: "none",
    cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center",
    color: "#9CA3AF",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: 600,
    color: "#374151", marginBottom: "6px",
    fontFamily: "'DM Sans', sans-serif",
  };

  /* ── Success state ── */
  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="success-pop w-20 h-20 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h3
          className="text-2xl font-extrabold mb-2"
          style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
        >
          Password Updated!
        </h3>
        <p className="text-gray-400 text-sm font-medium mb-8 max-w-[280px] leading-relaxed"
          style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Your password has been reset successfully. You can now log in with your new password.
        </p>
        <Link href="/auth/login" className="w-full">
          <Button fullWidth variant="primary"
            className="btn-action h-12 text-sm font-bold bg-[#1B3E5D] rounded-xl tracking-wide"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Go to Login
          </Button>
        </Link>
      </div>
    );
  }

  /* ── Form state ── */
  return (
    <form onSubmit={handleSubmit} className="space-y-5" style={{ isolation: "isolate" }}>

      {/* Missing token warning */}
      {!token && (
        <Alert type="error" className="rounded-xl text-sm">
          Missing reset token. Please check your email link.
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert type="error"
          className="mb-5 cursor-pointer bg-red-50 border-red-200 rounded-xl text-sm"
          onClick={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* New Password */}
      <div style={{ display: "block" }}>
        <label htmlFor="password" style={labelStyle}>New Password</label>
        <div style={inputWrapStyle}>
          <span style={iconStyle}><Lock className="w-5 h-5 text-gray-400" /></span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter new password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeStyle}>
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div style={{ display: "block" }}>
        <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
        <div style={inputWrapStyle}>
          <span style={iconStyle}><Lock className="w-5 h-5 text-gray-400" /></span>
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm new password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={eyeStyle}>
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Password mismatch hint */}
      {confirmPassword && password !== confirmPassword && (
        <p className="text-xs text-red-500 -mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Passwords do not match
        </p>
      )}

      {/* Submit */}
      <div className="pt-1">
        <Button
          type="submit"
          loading={loading}
          fullWidth
          variant="primary"
          disabled={!token}
          className="btn-action h-12 text-sm font-bold bg-[#1B3E5D] shadow-md cursor-pointer rounded-xl tracking-wide"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Set New Password
        </Button>
      </div>

      {/* Back to login */}
      <div className="mt-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-400 text-xs font-medium"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Remember your password?
          </span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <Link
          href="/auth/login"
          className="btn-back flex items-center justify-center gap-2 w-full h-11 rounded-xl border-2 border-[#1B3E5D]/20 text-[#1B3E5D] text-sm font-bold"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Back to Login
        </Link>
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE SHELL
   ══════════════════════════════════════════════════════════════ */
export default function ResetPasswordPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes successPop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        .success-pop { animation: successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        .reset-panel input::placeholder {
          font-size: 12.5px;
          color: #b0b7c3;
          font-family: 'DM Sans', sans-serif;
        }

        .btn-action {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.25s ease, background-color 0.2s ease;
        }
        .btn-action:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 28px rgba(27,62,93,0.45);
          background-color: #16324d;
        }
        .btn-action:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        .btn-back {
          transition: border-color 0.25s ease, background-color 0.25s ease,
                      color 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-back:hover {
          border-color: #1B3E5D;
          background-color: #1B3E5D;
          color: #ffffff;
          transform: translateY(-2px);
        }
      ` }} />

      {/* Full-page background — same as forgot-password */}
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: "url('/loginBg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          padding: "16px",
        }}
      >
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Centered card */}
        <div
          className="reset-panel relative z-10 bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] w-full"
          style={{ maxWidth: "460px", padding: "clamp(36px,6vw,52px) clamp(28px,6vw,48px)" }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Link href="/">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden transition-colors">
                <Image 
                src="/logo.svg" 
                alt="Obana Logistics" 
                width={90} height={48}
                style={{height:"auto"}} 
                 />
              </div>
            </Link>
          </div>

          {/* Heading — only shown in form state (success has its own heading) */}
          <Suspense fallback={null}>
            <ResetPasswordFormHeading />
          </Suspense>

          {/* Form */}
          <Suspense fallback={
            <div className="text-center py-8 text-gray-400 text-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Loading…
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}

/* Separate heading component so it can be wrapped in Suspense
   (avoids hydration mismatch from useSearchParams) */
function ResetPasswordFormHeading() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="mb-7">
      <h2
        className="text-[26px] font-extrabold leading-tight mb-1.5"
        style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
      >
        Create New Password
      </h2>
      <p className="text-gray-400 text-sm font-medium"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {token
          ? "Choose a strong password for your account"
          : "Invalid or expired link — request a new one"}
      </p>
    </div>
  );
}