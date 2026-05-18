// "use client";

// import React, { useState } from "react";
// import { Button, Input, Card, Alert } from "@/components/ui";
// import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";

// export default function ForgotPasswordPage() {
//     const [loading, setLoading] = useState(false);
//     const [email, setEmail] = useState("");
//     const [error, setError] = useState("");
//     const [success, setSuccess] = useState(false);

//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault();
//         setError("");
//         setLoading(true);

//         try {
//             const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/users/reset-password`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify({ user_identification: email })
//             });

//             const data = await response.json();

//             if (!response.ok) {
//                 throw new Error(data.message || 'Failed to process request');
//             }

//             setSuccess(true);
//         } catch (err: any) {
//             setError(err.message || "An error occurred. Please try again.");
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
//             <div className="w-full max-w-md">
//                 <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
//                     <div className="mb-6 text-center">
//                         <Link href="/" className="inline-block bg-[#f4f4f4] rounded-lg mb-4">
//                             <Image
//                                 src="/logo.svg"
//                                 alt="Obana Logistics Logo"
//                                 width={100}
//                                 height={100}
//                                 className="h-12 w-12 md:h-16 md:w-16"
//                             />
//                         </Link>
//                         <h2 className="text-2xl font-bold text-gray-900">
//                             Reset Password
//                         </h2>
//                         <p className="text-gray-600 mt-2">
//                             Enter your email or phone to receive reset instructions
//                         </p>
//                     </div>

//                     {success ? (
//                         <div className="text-center py-6">
//                             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                                 <CheckCircle className="w-8 h-8 text-green-600" />
//                             </div>
//                             <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Sent</h3>
//                             <p className="text-gray-600 mb-6">
//                                 If an account exists for <strong>{email}</strong>, you will receive instructions to reset your password shortly.
//                             </p>
//                             <Link href="/auth/login">
//                                 <Button fullWidth variant="primary">
//                                     Return to Login
//                                 </Button>
//                             </Link>
//                         </div>
//                     ) : (
//                         <form onSubmit={handleSubmit} className="space-y-6">
//                             {error && (
//                                 <Alert type="error" onClick={() => setError("")}>
//                                     {error}
//                                 </Alert>
//                             )}

//                             <Input
//                                 label="Email or Phone Number"
//                                 type="text"
//                                 placeholder="Enter your email or phone"
//                                 required
//                                 value={email}
//                                 onChange={(e) => setEmail(e.target.value)}
//                                 icon={<Mail className="w-5 h-5 text-gray-400" />}
//                             />

//                             <Button
//                                 type="submit"
//                                 loading={loading}
//                                 fullWidth
//                                 variant="primary"
//                                 className="h-12 font-semibold bg-[#1B3E5D]"
//                             >
//                                 Send Reset Link
//                             </Button>

//                             <div className="text-center">
//                                 <Link
//                                     href="/auth/login"
//                                     className="inline-flex items-center text-sm text-gray-600 hover:text-[#1B3E5D] font-medium transition-colors"
//                                 >
//                                     <ArrowLeft className="w-4 h-4 mr-2" />
//                                     Back to Login
//                                 </Link>
//                             </div>
//                         </form>
//                     )}
//                 </Card>
//             </div>
//         </div>
//     );
// }

"use client";

import React, { useState } from "react";
import { Button, Alert } from "@/components/ui";
import { Mail, ArrowLeft, CheckCircle, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/* ── All original logic untouched ── */
export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/users/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_identification: email }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to process request");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared input focus handlers ── */
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
        .forgot-panel { font-family: 'DM Sans', sans-serif; }
        .forgot-panel input::placeholder {
          font-size: 12.5px;
          color: #b0b7c3;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-reset {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.25s ease, background-color 0.2s ease;
        }
        .btn-reset:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 28px rgba(27,62,93,0.45);
          background-color: #16324d;
        }
        .btn-reset:active:not(:disabled) {
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

      {/* Full-page background */}
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
        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* ── Centered form card ── */}
        <div
          className="forgot-panel relative z-10 bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] w-full"
          style={{ maxWidth: "460px", padding: "clamp(36px,6vw,52px) clamp(28px,6vw,48px)" }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Link href="/">
              <div className="w-24 h-24 rounded flex items-center justify-center overflow-hidden transition-colors">
                <Image src="/logo-blue.png" 
                alt="Obana Logistics" 
                width={98} height={48}
                style={{height:"auto"}} 
                className="object-contain" />
              </div>
            </Link>
          </div>

          {/* ── SUCCESS STATE ── */}
          {success ? (
            <div className="flex flex-col items-center text-center">
              <div className="success-pop w-20 h-20 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3
                className="text-2xl font-extrabold mb-2"
                style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
              >
                Check your inbox
              </h3>
              <p className="text-gray-400 text-sm font-medium mb-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                We sent reset instructions to
              </p>
              <p className="text-[#1B3E5D] text-sm font-bold mb-6 px-4 py-2 rounded-xl"
                style={{ fontFamily: "'DM Sans', sans-serif", background: "rgba(27,62,93,0.07)" }}>
                {email}
              </p>
              <p className="text-gray-400 text-xs mb-8 max-w-[280px] leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                If an account exists for this address, you will receive the reset link shortly. Check your spam folder too.
              </p>
              <Link href="/auth/login" className="w-full">
                <Button fullWidth variant="primary"
                  className="btn-reset h-12 text-sm font-bold bg-[#1B3E5D] rounded-xl tracking-wide"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Return to Login
                </Button>
              </Link>
            </div>

          ) : (
            /* ── FORM STATE ── */
            <div>
              {/* Heading */}
              <div className="mb-7">
                <h2
                  className="text-[26px] font-extrabold leading-tight mb-1.5"
                  style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Reset Password
                </h2>
                <p className="text-gray-400 text-sm font-medium"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Enter your email or phone to receive reset instructions
                </p>
              </div>

              {/* Error */}
              {error && (
                <Alert type="error"
                  className="mb-5 cursor-pointer bg-red-50 border-red-200 rounded-xl text-sm"
                  onClick={() => setError("")}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" style={{ isolation: "isolate" }}>

                {/* Email / phone — native stable input */}
                <div style={{ display: "block" }}>
                  <label htmlFor="email" style={{
                    display: "block", fontSize: "13px", fontWeight: 600,
                    color: "#374151", marginBottom: "6px", fontFamily: "'DM Sans', sans-serif",
                  }}>
                    Email or Phone Number
                  </label>
                  <div style={{ position: "relative", height: "44px" }}>
                    <span style={{
                      position: "absolute", left: "12px", top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                      display: "flex", alignItems: "center", zIndex: 1,
                    }}>
                      <Mail className="w-5 h-5 text-gray-400" />
                    </span>
                    <input
                      id="email"
                      type="text"
                      placeholder="Enter your email or phone"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%",
                        boxSizing: "border-box",
                        paddingLeft: "40px", paddingRight: "14px",
                        fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
                        color: "#111827", background: "#F9FAFB",
                        border: "1.5px solid #E5E7EB", borderRadius: "10px",
                        outline: "none",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <Button type="submit" loading={loading} fullWidth variant="primary"
                    className="btn-reset h-12 text-sm font-bold bg-[#1B3E5D] shadow-md cursor-pointer rounded-xl tracking-wide"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Send Reset Link
                  </Button>
                </div>
              </form>

              {/* Divider + back */}
              <div className="mt-7">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-gray-400 text-xs font-medium"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Remember your password?
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <Link href="/auth/login"
                  className="btn-back flex items-center justify-center gap-2 w-full h-11 rounded-xl border-2 border-[#1B3E5D]/20 text-[#1B3E5D] text-sm font-bold"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

}