'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Alert } from '@/components/ui';
import { Mail, Phone, Lock, Package, Truck, Shield, Users } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { signup, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'role' | 'info'>('role');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [formData, setFormData] = useState({ email: '', phone: '', password: '', confirmPassword: '' });

  const roles = [
    { 
      id: 'customer', 
      label: 'Customer', 
      description: 'Ship packages & track deliveries',
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      hoverBorder: 'hover:border-blue-500',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    { 
      id: 'driver', 
      label: 'Driver', 
      description: 'Accept deliveries & earn money',
      icon: Truck,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      hoverBorder: 'hover:border-green-500',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    { 
      id: 'admin', 
      label: 'Admin', 
      description: 'Manage operations & analytics',
      icon: Shield,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      hoverBorder: 'hover:border-purple-500',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep('info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !formData.email || !formData.phone || !formData.password) return;

    if (formData.password !== formData.confirmPassword) {
      return;
    }

    setLoading(true);
    try {
      const response = await signup(formData.email, formData.phone, formData.password, selectedRole);
      if (response?.data?.request_id) {
        router.push(`/auth/otp?request_id=${response.data.request_id}&email=${formData.email}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <Package className="absolute top-1/4 right-1/4 w-16 h-16 text-white/5 animate-float" />
        <Truck className="absolute bottom-1/3 left-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-2xl mb-4 transform hover:scale-105 transition-transform">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Obana</h1>
          <p className="text-blue-200 text-lg font-medium">Logistics Made Simple</p>
        </div>

        {/* Signup Card */}
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
          {error && (
            <Alert
              type="error"
              className="mb-6 cursor-pointer bg-red-50 border-red-200"
              onClick={clearError}
            >
              {error}
            </Alert>
          )}

          {step === 'role' ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-600">Choose how you want to use Obana</p>
              </div>

              <div className="space-y-4">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleRoleSelect(role.id)}
                      className={`w-full p-5 border-2 ${role.borderColor} rounded-xl ${role.hoverBorder} hover:shadow-lg transition-all text-left group relative overflow-hidden`}
                    >
                      <div className={`absolute inset-0 ${role.bgColor} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                      <div className="relative flex items-start space-x-4">
                        <div className={`flex-shrink-0 w-12 h-12 ${role.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-6 h-6 ${role.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg mb-1">{role.label}</h3>
                          <p className="text-sm text-gray-600">{role.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
                    Sign In
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="flex items-center space-x-3 mb-6">
                  {selectedRoleData && (
                    <>
                      <div className={`w-12 h-12 ${selectedRoleData.iconBg} rounded-lg flex items-center justify-center`}>
                        <selectedRoleData.icon className={`w-6 h-6 ${selectedRoleData.iconColor}`} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          Sign up as {selectedRoleData.label}
                        </h2>
                        <p className="text-sm text-gray-600">{selectedRoleData.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                icon={<Mail className="w-5 h-5 text-gray-400" />}
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+234 800 000 0000"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                icon={<Phone className="w-5 h-5 text-gray-400" />}
              />

              <Input
                label="Password"
                type="password"
                placeholder="Create a strong password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                icon={<Lock className="w-5 h-5 text-gray-400" />}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter your password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                icon={<Lock className="w-5 h-5 text-gray-400" />}
              />

              <Button 
                type="submit" 
                loading={loading} 
                fullWidth 
                variant="primary" 
                className="h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              >
                Create Account
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('role');
                  setSelectedRole('');
                }}
                className="w-full text-gray-600 hover:text-gray-800 font-medium text-sm py-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                ← Back to Role Selection
              </button>
            </form>
          )}
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 text-center">
          <p className="text-blue-200 text-sm mb-3">Join thousands of satisfied users</p>
          <div className="flex items-center justify-center space-x-6 text-white/60">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">5k+ Users</span>
            </div>
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span className="text-xs">50k+ Deliveries</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}