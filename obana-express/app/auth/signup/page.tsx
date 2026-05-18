// "use client";

// import React, { useState } from "react";
// import { useAuth } from "@/lib/authContext";
// import { uploadToCloudinary } from "@/lib/cloudinary";
// import { useRouter } from "next/navigation";
// import { Button, Card, Alert, Select, Input } from "@/components/ui";
// import PhoneInput from "@/components/PhoneInput";
// import { LocationInput } from "@/components/LocationInput";
// import {
// 	Mail,
// 	Phone,
// 	Lock,
// 	Package,
// 	Truck,
// 	Users,
// 	EyeOff,
// 	Eye,
// 	Contact,
// 	MapPin,
// 	FileText,
// 	Upload,
// 	Shield,
// } from "lucide-react";
// import Image from "next/image";
// import Link from "next/link";

// export default function SignupPage() {
// 	const router = useRouter();
// 	const { signup, error, clearError } = useAuth();
// 	const [loading, setLoading] = useState(false);
// 	const [formError, setFormError] = useState("");
// 	const [step, setStep] = useState<"role" | "info">("role");
// 	const [selectedRole, setSelectedRole] = useState<string>("");
// 	const [showPassword, setShowPassword] = useState(false);
// 	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
// 	const [formData, setFormData] = useState({
// 		first_name: "",
// 		last_name: "",
// 		email: "",
// 		phone: "",
// 		password: "",
// 		confirmPassword: "",
// 	});

	
// 	const [agentData, setAgentData] = useState({
// 		government_id_type: 'NIN',
// 		government_id_number: '',
// 		country: 'Nigeria',
// 		countryCode: 'NG',
// 		state: '',
// 		stateCode: '',
// 		city: '',
// 		lga: '',
// 		assigned_zone: '',
// 		service_radius: '',
// 		latitude: '',
// 		longitude: '',
// 		government_id_image: '',
// 		profile_photo: ''
// 	});

	
// 	const [agentFiles, setAgentFiles] = useState<{
// 		government_id_image: File | null;
// 		profile_photo: File | null;
// 	}>({ government_id_image: null, profile_photo: null });

// 	const roles = [
// 		{
// 			id: "customer",
// 			label: "Customer",
// 			description: "Ship packages & track deliveries",
// 			icon: Package,
// 			color: "from-blue-500 to-blue-600",
// 			bgColor: "bg-blue-50",
// 			borderColor: "border-blue-200",
// 			hoverBorder: "hover:border-blue-500",
// 			iconBg: "bg-blue-100",
// 			iconColor: "text-blue-600",
// 		},
// 		{
// 			id: "driver",
// 			label: "Driver",
// 			description: "Accept deliveries & earn money",
// 			icon: Truck,
// 			color: "from-green-500 to-green-600",
// 			bgColor: "bg-green-50",
// 			borderColor: "border-green-200",
// 			hoverBorder: "hover:border-green-500",
// 			iconBg: "bg-green-100",
// 			iconColor: "text-green-600",
// 		},
// 		{
// 			id: "agent",
// 			label: "Agent",
// 			description: "Manage operations & analytics",
// 			icon: Shield,
// 			color: "from-purple-500 to-purple-600",
// 			bgColor: "bg-purple-50",
// 			borderColor: "border-purple-200",
// 			hoverBorder: "hover:border-purple-500",
// 			iconBg: "bg-purple-100",
// 			iconColor: "text-purple-600",
// 		},
// 	];

// 	const handleRoleSelect = (roleId: string) => {
// 		setSelectedRole(roleId);
// 		setStep("info");
// 	};

// 	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
// 		const file = e.target.files?.[0];
// 		if (file) {
// 			setAgentFiles(prev => ({ ...prev, [field]: file }));
// 			// Store object URL for preview/truthiness check in UI
// 			setAgentData(prev => ({
// 				...prev,
// 				[field]: URL.createObjectURL(file)
// 			}));
// 		}
// 	};

// 	const handleSubmit = async (e: React.FormEvent) => {
// 		e.preventDefault();
// 		if (
// 			!selectedRole ||
// 			!formData.email ||
// 			!formData.phone ||
// 			!formData.password
// 		)
// 			return;

// 		if (formData.password !== formData.confirmPassword) {
// 			return;
// 		}

// 		setLoading(true);
// 		setFormError(""); // Clear previous errors
// 		const payload = { ...formData };
// 		let additionalData = selectedRole === 'agent' ? { ...agentData } : {};

// 		try {
			
// 			if (selectedRole === 'agent') {
// 				if (agentFiles.government_id_image) {
// 					try {
// 						const url = await uploadToCloudinary(agentFiles.government_id_image);
// 						additionalData = { ...additionalData, government_id_image: url };
// 					} catch (e) {
// 						console.error("Government ID upload failed", e);
// 						additionalData = { ...additionalData, government_id_image: '' };
// 					}
// 				}
// 				if (agentFiles.profile_photo) {
// 					try {
// 						const url = await uploadToCloudinary(agentFiles.profile_photo);
// 						additionalData = { ...additionalData, profile_photo: url };
// 					} catch (e) {
// 						console.error("Profile photo upload failed", e);
// 						additionalData = { ...additionalData, profile_photo: '' };
// 					}
// 				}
// 			}

// 			const response = await signup(
// 				formData.first_name,
// 				formData.last_name,
// 				formData.email,
// 				formData.phone,
// 				formData.password,
// 				selectedRole,
// 				additionalData
// 			);
// 			type RoleType = 'customer' | 'driver' | 'admin' | 'agent';


// const roleRoutes: Record<RoleType, string> = {
//     customer: '/dashboard/customer',
//     driver: '/dashboard/driver',
//     admin: '/dashboard/admin',
//     agent: '/dashboard/agent',
// };

// const role = response.data.user.role as RoleType;
// const route = roleRoutes[role]; 
// 			router.replace(
// 				response?.data?.user?.role
// 					? route || '/'
// 					: '/'
// 			);
// 		} catch (err) {
// 			console.error("Signup Error:", err);
// 			// Display error to user
// 			setFormError(err instanceof Error ? err.message : "An error occurred during signup");
// 		} finally {
// 			setLoading(false);
// 		}
// 	};

// 	const selectedRoleData = roles.find((r) => r.id === selectedRole);

// 	return (
// 		<div className="min-h-screen bg-linear from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
// 			{/* Animated background elements */}
// 			<div className="absolute inset-0 overflow-hidden pointer-events-none">
// 				<div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
// 				<div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
// 				<Package className="absolute top-1/4 right-1/4 w-16 h-16 text-white/5 animate-float" />
// 				<Truck className="absolute bottom-1/3 left-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
// 			</div>

// 			<div className="w-full max-w-md relative z-10">
// 				{/* Signup Card */}
// 				<Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
// 					{/* Logo and Brand Section */}
// 					<div className="text-center mb-8">
// 						<Link
// 							href="/"
// 							className="flex items-center justify-center bg-[#f4f4f4] rounded-lg "
// 						>
// 							<Image
// 								src="/logo.svg"
// 								alt="Obana Logistics Logo"
// 								width={100}
// 								height={100}
// 								className="ml-2"
// 							/>
// 						</Link>
// 						<p className="text-[#1B3E5D] text-lg font-medium">
// 							Logistics Made Simple
// 						</p>
// 					</div>

// 					{(error || formError) && (
// 						<Alert
// 							type="error"
// 							className="mb-6 cursor-pointer bg-red-50 border-red-200"
// 							onClick={() => {
// 								clearError();
// 								setFormError("");
// 							}}
// 						>
// 							{error || formError}
// 						</Alert>
// 					)}

// 					{step === "role" ? (
// 						<div>
// 							<div className="mb-6">
// 								<h2 className="text-2xl font-bold text-gray-900 mb-2">
// 									Get Started
// 								</h2>
// 								<p className="text-gray-600">
// 									Choose how you want to use Obana
// 								</p>
// 							</div>

// 							<div className="space-y-4">
// 								{roles.map((role) => {
// 									const Icon = role.icon;
// 									return (
// 										<button
// 											key={role.id}
// 											onClick={() => handleRoleSelect(role.id)}
// 											className={`w-full p-5 border-2 ${role.borderColor} rounded-xl ${role.hoverBorder} hover:shadow-lg transition-all text-left group relative overflow-hidden`}
// 										>
// 											<div
// 												className={`absolute inset-0 ${role.bgColor} opacity-0 group-hover:opacity-100 transition-opacity`}
// 											></div>
// 											<div className="relative flex items-start space-x-4">
// 												<div
// 													className={`shrink-0 w-12 h-12 ${role.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}
// 												>
// 													<Icon className={`w-6 h-6 ${role.iconColor}`} />
// 												</div>
// 												<div className="flex-1">
// 													<h3 className="font-bold text-gray-900 text-lg mb-1">
// 														{role.label}
// 													</h3>
// 													<p className="text-sm text-gray-600">
// 														{role.description}
// 													</p>
// 												</div>
// 												<div className="shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
// 													<svg
// 														className="w-5 h-5"
// 														fill="none"
// 														stroke="currentColor"
// 														viewBox="0 0 24 24"
// 													>
// 														<path
// 															strokeLinecap="round"
// 															strokeLinejoin="round"
// 															strokeWidth={2}
// 															d="M9 5l7 7-7 7"
// 														/>
// 													</svg>
// 												</div>
// 											</div>
// 										</button>
// 									);
// 								})}
// 							</div>

// 							<div className="mt-6 pt-6 border-t border-gray-200 text-center">
// 								<p className="text-gray-600">
// 									Already have an account?{" "}
// 									<a
// 										href="/auth/login"
// 										className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
// 									>
// 										Sign In
// 									</a>
// 								</p>
// 							</div>
// 						</div>
// 					) : (
// 						<form onSubmit={handleSubmit} className="space-y-5">
// 							<div>
// 								<div className="flex items-center space-x-3 mb-6">
// 									{selectedRoleData && (
// 										<>
// 											<div
// 												className={`w-12 h-12 ${selectedRoleData.iconBg} rounded-lg flex items-center justify-center`}
// 											>
// 												<selectedRoleData.icon
// 													className={`w-6 h-6 ${selectedRoleData.iconColor}`}
// 												/>
// 											</div>
// 											<div>
// 												<h2 className="text-xl font-bold text-gray-900">
// 													Sign up as {selectedRoleData.label}
// 												</h2>
// 												<p className="text-sm text-gray-600">
// 													{selectedRoleData.description}
// 												</p>
// 											</div>
// 										</>
// 									)}
// 								</div>
// 							</div>
// 							<div className="flex  gap-4">
// 								<Input
// 									label="First Name"
// 									type="text"
// 									placeholder="John"
// 									required
// 									value={formData.first_name}
// 									onChange={(e) =>
// 										setFormData({ ...formData, first_name: e.target.value })
// 									}
// 									icon={<Contact className="w-5 h-5 text-gray-400" />}
// 								/>
// 								<Input
// 									label="Last Name"
// 									type="text"
// 									placeholder="Doe"
// 									required
// 									value={formData.last_name}
// 									onChange={(e) =>
// 										setFormData({ ...formData, last_name: e.target.value })
// 									}
// 									icon={<Contact className="w-5 h-5 text-gray-400" />}
// 								/>
// 							</div>
// 							<Input
// 								label="Email Address"
// 								type="email"
// 								placeholder="you@example.com"
// 								required
// 								value={formData.email}
// 								onChange={(e) =>
// 									setFormData({ ...formData, email: e.target.value })
// 								}
// 								icon={<Mail className="w-5 h-5 text-gray-400" />}
// 							/>

// 				<PhoneInput
// 					label="Phone Number"
// 					required
// 					value={formData.phone}
// 					onChange={(val) =>
// 						setFormData({ ...formData, phone: val })
// 					}
// 							/>

// 							{/* Agent Specific Fields */}
// 							{selectedRole === 'agent' && (
// 								<div className="space-y-4 pt-4 border-t border-gray-100">
// 									<h3 className="font-semibold text-gray-900">Agent Details</h3>
									
// 									<div className="grid grid-cols-2 gap-4">
// 										<Select
// 											label="ID Type"
// 											value={agentData.government_id_type}
// 											onChange={(e) => setAgentData({...agentData, government_id_type: e.target.value})}
// 											options={[
// 												{ value: 'NIN', label: 'NIN' },
// 												{ value: 'Passport', label: 'Intl Passport' },
// 												{ value: 'VoterID', label: 'Voter ID' }
// 											]}
// 										/>
// 										<Input
// 											label="ID Number"
// 											placeholder="Enter ID Number"
// 											value={agentData.government_id_number}
// 											onChange={(e) => setAgentData({...agentData, government_id_number: e.target.value})}
// 											required
// 										/>
// 									</div>

// 									<div className="py-1">
// 										<LocationInput
// 											label="Agent Location"
// 											value={{
// 												city: agentData.city,
// 												state: agentData.state,
// 												country: agentData.country,
// 												countryCode: agentData.countryCode,
// 												stateCode: agentData.stateCode,
// 											}}
// 											onChange={(location) => setAgentData(prev => ({
// 												...prev,
// 												...location
// 											}))}
// 											required
// 											placeholder="Search for city..."
// 										/>
// 									</div>

// 									<div className="grid grid-cols-2 gap-4">
// 										{/* <Input
// 											label="LGA"
// 											placeholder="Ikeja"
// 											value={agentData.lga}
// 											onChange={(e) => setAgentData({...agentData, lga: e.target.value})}
// 										/> */}
// 										{/*<Input
// 											label="Zone"
// 											placeholder="Zone A"
// 											value={agentData.assigned_zone}
// 											onChange={(e) => setAgentData({...agentData, assigned_zone: e.target.value})}
// 										/> */}
// 									</div>

// 									{/* <Input
// 										label="Service Radius (km)"
// 										type="number"
// 										placeholder="e.g. 10"
// 										value={agentData.service_radius}
// 										onChange={(e) => setAgentData({...agentData, service_radius: e.target.value})}
// 									/> */}

// 									<div className="space-y-2">
// 										<label className="block text-sm font-medium text-gray-700">Upload Government ID</label>
// 										<div className="flex items-center gap-2">
// 											<input
// 												type="file"
// 												accept="image/*"
// 												onChange={(e) => handleFileChange(e, 'government_id_image')}
// 												className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
// 											/>
// 											{agentData.government_id_image && <span className="text-green-600 text-xs">Uploaded</span>}
// 										</div>
// 									</div>

// 									<div className="space-y-2">
// 										<label className="block text-sm font-medium text-gray-700">Upload Profile Photo</label>
// 										<div className="flex items-center gap-2">
// 											<input
// 												type="file"
// 												accept="image/*"
// 												onChange={(e) => handleFileChange(e, 'profile_photo')}
// 												className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
// 											/>
// 											{agentData.profile_photo && <span className="text-green-600 text-xs">Uploaded</span>}
// 										</div>
// 									</div>
// 								</div>
// 							)}

// 							{/* Password */}
// 							<div className="relative">
// 								<Input
// 									label="Password"
// 									type={showPassword ? "text" : "password"}
// 									placeholder="Create a strong password"
// 									required
// 									value={formData.password}
// 									onChange={(e) =>
// 										setFormData({ ...formData, password: e.target.value })
// 									}
// 									icon={<Lock className="w-5 h-5 text-gray-400" />}
// 									className="pr-10"
// 								/>
// 								<button
// 									type="button"
// 									onClick={() => setShowPassword(!showPassword)}
// 									className="absolute right-3 top-10.5 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
// 								>
// 									{showPassword ? (
// 										<EyeOff className="w-5 h-5" />
// 									) : (
// 										<Eye className="w-5 h-5" />
// 									)}
// 								</button>
// 							</div>

// 							{/* Confirm Password */}
// 							<div className="relative">
// 								<Input
// 									label="Confirm Password"
// 									type={showConfirmPassword ? "text" : "password"}
// 									placeholder="Re-enter your password"
// 									required
// 									value={formData.confirmPassword}
// 									onChange={(e) =>
// 										setFormData({
// 											...formData,
// 											confirmPassword: e.target.value,
// 										})
// 									}
// 									icon={<Lock className="w-5 h-5 text-gray-400" />}
// 									className="pr-10"
// 								/>
// 								<button
// 									type="button"
// 									onClick={() => setShowConfirmPassword(!showConfirmPassword)}
// 									className="absolute right-3 top-12.5 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
// 								>
// 									{showConfirmPassword ? (
// 										<EyeOff className="w-5 h-5" />
// 									) : (
// 										<Eye className="w-5 h-5" />
// 									)}
// 								</button>
// 							</div>

// 							<Button
// 								type="submit"
// 								loading={loading}
// 								fullWidth
// 								variant="primary"
// 								className="h-12 text-base font-semibold bg-[#1B3E5D] shadow-lg"
// 							>
// 								Create Account
// 							</Button>

// 							<button
// 								type="button"
// 								onClick={() => {
// 									setStep("role");
// 									setSelectedRole("");
// 								}}
// 								className="w-full text-gray-600 hover:text-gray-800 font-medium text-sm py-2 hover:bg-gray-50 rounded-lg transition-colors"
// 							>
// 								← Back to Role Selection
// 							</button>
// 						</form>
// 					)}
// 				</Card>

// 				{/* Trust Indicators */}
// 				<div className="mt-8 text-center">
// 					<p className="text-blue-200 text-sm mb-3">
// 						Join thousands of satisfied users
// 					</p>
// 					<div className="flex items-center justify-center space-x-6 text-white/60">
// 						<div className="flex items-center space-x-2">
// 							<Users className="w-4 h-4" />
// 							<span className="text-xs">5k+ Users</span>
// 						</div>
// 						<div className="flex items-center space-x-2">
// 							<Package className="w-4 h-4" />
// 							<span className="text-xs">50k+ Deliveries</span>
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
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import { Button, Card, Alert, Select, Input } from "@/components/ui";
import PhoneInput from "@/components/PhoneInput";
import { LocationInput } from "@/components/LocationInput";
import {
  Mail, Phone, Lock, Package, Truck, Users,
  EyeOff, Eye, Contact, MapPin, FileText, Upload, Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/* ─── All original logic is untouched below ─────────────────── */
export default function SignupPage() {
  const router = useRouter();
  const { signup, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [step, setStep] = useState<"role" | "info">("role");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [agentData, setAgentData] = useState({
    government_id_type: "NIN",
    government_id_number: "",
    country: "Nigeria",
    countryCode: "NG",
    state: "",
    stateCode: "",
    city: "",
    lga: "",
    assigned_zone: "",
    service_radius: "",
    latitude: "",
    longitude: "",
    government_id_image: "",
    profile_photo: "",
  });

  const [agentFiles, setAgentFiles] = useState<{
    government_id_image: File | null;
    profile_photo: File | null;
  }>({ government_id_image: null, profile_photo: null });

  const roles = [
    {
      id: "customer",
      label: "Customer",
      description: "Ship packages & track deliveries",
      icon: Package,
      borderColor: "border-blue-200",
      hoverBorder: "hover:border-blue-500",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      activeBg: "bg-blue-50",
    },
    {
      id: "driver",
      label: "Driver",
      description: "Accept deliveries & earn money",
      icon: Truck,
      borderColor: "border-green-200",
      hoverBorder: "hover:border-green-500",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      activeBg: "bg-green-50",
    },
    {
      id: "agent",
      label: "Agent",
      description: "Manage operations & analytics",
      icon: Shield,
      borderColor: "border-purple-200",
      hoverBorder: "hover:border-purple-500",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      activeBg: "bg-purple-50",
    },
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep("info");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setAgentFiles((prev) => ({ ...prev, [field]: file }));
      setAgentData((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !formData.email || !formData.phone || !formData.password) return;
    if (formData.password !== formData.confirmPassword) return;

    setLoading(true);
    setFormError("");
    const payload = { ...formData };
    let additionalData = selectedRole === "agent" ? { ...agentData } : {};

    try {
      if (selectedRole === "agent") {
        if (agentFiles.government_id_image) {
          try {
            const url = await uploadToCloudinary(agentFiles.government_id_image);
            additionalData = { ...additionalData, government_id_image: url };
          } catch (e) {
            console.error("Government ID upload failed", e);
            additionalData = { ...additionalData, government_id_image: "" };
          }
        }
        if (agentFiles.profile_photo) {
          try {
            const url = await uploadToCloudinary(agentFiles.profile_photo);
            additionalData = { ...additionalData, profile_photo: url };
          } catch (e) {
            console.error("Profile photo upload failed", e);
            additionalData = { ...additionalData, profile_photo: "" };
          }
        }
      }

      const response = await signup(
        formData.first_name,
        formData.last_name,
        formData.email,
        formData.phone,
        formData.password,
        selectedRole,
        additionalData
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
      router.replace(response?.data?.user?.role ? route || "/" : "/");
    } catch (err) {
      console.error("Signup Error:", err);
      setFormError(err instanceof Error ? err.message : "An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleData = roles.find((r) => r.id === selectedRole);

  /* ─── Shared native input style ──────── */
  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    height: "44px",
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
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#1B3E5D";
    e.target.style.boxShadow = "0 0 0 3px rgba(27,62,93,0.08)";
    e.target.style.background = "#fff";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#E5E7EB";
    e.target.style.boxShadow = "none";
    e.target.style.background = "#F9FAFB";
  };

  const iconWrap: React.CSSProperties = {
    position: "absolute", left: "12px", top: "50%",
    transform: "translateY(-50%)", pointerEvents: "none",
    display: "flex", alignItems: "center", zIndex: 1,
  };

  /* ─── Native field helper ─────────────────────────────────── */
  const NativeField = ({
    id, label, type = "text", placeholder, value, onChange, icon, rightEl, required = false,
  }: {
    id: string; label: string; type?: string; placeholder: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: React.ReactNode; rightEl?: React.ReactNode; required?: boolean;
  }) => (
    <div style={{ display: "block" }}>
      <label htmlFor={id} style={{
        display: "block", fontSize: "13px", fontWeight: 600,
        color: "#374151", marginBottom: "6px", fontFamily: "'DM Sans', sans-serif",
      }}>
        {label}
      </label>
      <div style={{ position: "relative", height: "44px" }}>
        <span style={iconWrap}>{icon}</span>
        <input
          id={id} type={type} placeholder={placeholder}
          required={required} value={value} onChange={onChange}
          style={{ ...inputStyle, position: "absolute", inset: 0, width: "100%", height: "100%",
            paddingRight: rightEl ? "44px" : "14px" }}
          onFocus={onFocus} onBlur={onBlur}
        />
        {rightEl && (
          <span style={{
            position: "absolute", right: "12px", top: "50%",
            transform: "translateY(-50%)", zIndex: 1,
          }}>
            {rightEl}
          </span>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════ */
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

        .signup-panel { font-family: 'DM Sans', sans-serif; }
        .signup-panel input::placeholder,
        .signup-panel textarea::placeholder {
          font-size: 12.5px;
          color: #b0b7c3;
          font-family: 'DM Sans', sans-serif;
        }

        /* Role cards */
        .role-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease,
                      transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .role-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(27,62,93,0.12);
        }

        /* Submit button */
        .btn-signup {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.25s ease, background-color 0.2s ease;
        }
        .btn-signup:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 28px rgba(27,62,93,0.45);
          background-color: #16324d;
        }
        .btn-signup:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        /* Sign in / back link */
        .link-signin {
          transition: color 0.2s ease, letter-spacing 0.2s ease;
        }
        .link-signin:hover { color: #0f2438; letter-spacing: 0.01em; }

        /* Scrollable form area */
        .form-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #E5E7EB transparent;
        }
        .form-scroll::-webkit-scrollbar { width: 4px; }
        .form-scroll::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 2px; }
      ` }} />

      {/* ── Full-page background ── */}
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
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Package className="absolute top-1/4 left-1/4 w-16 h-16 text-white/5 animate-float" />
          <Truck className="absolute bottom-1/3 right-1/4 w-20 h-20 text-white/5 animate-float-delayed" />
        </div>

        {/* ══ SPLIT CARD ══ */}
        <div
          className="relative z-10 w-full flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
          style={{ maxWidth: "1000px" }}
        >
          {/* ── IMAGE PANEL ── */}
          <div className="relative flex-shrink-0" style={{ flex: "0 0 50%" }}>

            {/* Mobile banner */}
            <div className="md:hidden" style={{ height: "200px", position: "relative" }}>
              <Image 
			  src="/loginBg.jpg" 
			  alt="Obana Logistics" 
			  fill 
			  priority 
			  quality={75}
              sizes="(max-width: 768px) 100vw, 500px" 
			  className="object-cover object-center" />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg,rgba(10,20,40,0.78)0%,rgba(10,20,40,0.25)50%,rgba(10,20,40,0.82)100%)",
              }} />
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div className="flex items-center gap-3">
                  <Link href="/">
                    <div className="w-24 h-24 rounded- backdrop-blur-md flex items-center justify-center hover:bg-white/25 overflow-hidden">
                      <Image 
					  src="/white-logo.svg" alt="Obana" 
					  width={94} height={64}
					  style={{height:"auto"}} 
					  className="object-contain" />
                    </div>
                  </Link>
                  <div>
                    <p className="text-white text-sm font-extrabold leading-tight">Obana Logistics</p>
                    <p className="text-white/55 text-[9px] font-semibold uppercase tracking-widest">Logistics Made Simple</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-1.5">
                    <Users className="w-3 h-3 text-white" />
                    <span className="text-white text-xs font-bold">5k+ Users</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 rounded-full px-3 py-1.5">
                    <Package className="w-3 h-3 text-[#1B3E5D]" />
                    <span className="text-[#1B3E5D] text-xs font-bold">50k+ Deliveries</span>
                  </div>
                  <div className="flex flex-col bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-1.5">
                    <span className="text-white text-sm font-extrabold leading-none">500+</span>
                    <span className="text-white/60 text-[9px]">Drivers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop image panel */}
            <div className="hidden md:block" style={{ position: "relative", width: "500px", height: "100%" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <Image 
				src="/loginBg.jpg" alt="Obana 
				Logistics" fill 
				priority 
				quality={75}
                sizes="(max-width: 768px) 0vw, 500px" 
				className="object-cover object-center" />
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(180deg,rgba(10,20,40,0.72)0%,rgba(10,20,40,0.20)40%,rgba(10,20,40,0.80)100%)",
                }} />
                <div className="absolute inset-0 flex flex-col justify-between p-8">

                  {/* TOP — logo */}
                  <div className="pill-1 flex flex-col items-start gap-3">
                    <Link href="/">
                      <div className="w-24 h-24 rounded backdrop-blur-md flex items-center justify-center hover:bg-white/25 overflow-hidden hover:bg-white/25 transition-colors">
                        <Image 
						src="/white-logo.svg" 
						alt="Obana Logistics" 
						width={94} height={64} 
						style={{height:"auto"}}
						className="object-contain" />
                      </div>
                    </Link>
                    <div className="mt-1">
                      <p className="text-white text-xl font-extrabold leading-tight tracking-tight">Obana Logistics</p>
                      <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mt-1">Logistics Made Simple</p>
                    </div>
                  </div>

                  {/* MIDDLE — users pill */}
                  <div className="pill-2 self-end flex flex-col bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-5 py-4">
                    <p className="text-white text-2xl font-extrabold leading-none">5k+</p>
                    <p className="text-white/65 text-xs font-medium mt-1 leading-snug">
                      Registered<br />Users
                    </p>
                  </div>

                  {/* BOTTOM — stat pills */}
                  <div className="flex flex-col items-start gap-3">
                    <div className="pill-3 flex items-center gap-3 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-3">
                      <div className="w-8 h-8 rounded-xl bg-[#1B3E5D] flex items-center justify-center flex-shrink-0">
                        <Package className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-white/55 text-[10px] font-semibold uppercase tracking-wider leading-none mb-0.5">Deliveries done</p>
                        <p className="text-white text-sm font-bold leading-none">50k+ Packages</p>
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

          {/* ── FORM PANEL ── */}
          <div
            className="signup-panel flex flex-col bg-white w-full"
            style={{
              flex: 1,
              padding: "clamp(24px,4vw,40px) clamp(20px,4vw,44px)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Error */}
            {(error || formError) && (
              <Alert type="error"
                className="mb-5 cursor-pointer bg-red-50 border-red-200 rounded-xl text-sm"
                onClick={() => { clearError(); setFormError(""); }}>
                {error || formError}
              </Alert>
            )}

            {/* ── STEP 1: Role selection ── */}
            {step === "role" && (
              <div className="flex flex-col h-full">
                <div className="mb-6">
                  <h2
                    className="text-[26px] font-extrabold leading-tight mb-1"
                    style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Get Started 
                  </h2>
                  <p className="text-gray-400 text-sm font-medium">
                    Choose how you want to use Obana
                  </p>
                </div>

                <div className="space-y-3 flex-1">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role.id)}
                        className={`role-card w-full p-4 border-2 ${role.borderColor} ${role.hoverBorder} rounded-2xl text-left group relative overflow-hidden`}
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <div className={`absolute inset-0 ${role.activeBg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <div className="relative flex items-center gap-4">
                          <div className={`shrink-0 w-11 h-11 ${role.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <Icon className={`w-5 h-5 ${role.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-base leading-tight mb-0.5"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}>
                              {role.label}
                            </p>
                            <p className="text-xs text-gray-500">{role.description}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors shrink-0"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Divider + sign in */}
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-gray-400 text-xs font-medium">Already registered?</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <a href="/auth/login"
                    className="flex items-center justify-center w-full h-11 rounded-xl border-2 border-[#1B3E5D]/20 text-[#1B3E5D] text-sm font-bold hover:border-[#1B3E5D] hover:bg-[#1B3E5D] hover:text-white transition-all duration-200"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Sign In
                  </a>
                </div>
              </div>
            )}

            {/* ── STEP 2: Info form ── */}
            {step === "info" && (
              <form onSubmit={handleSubmit} className="space-y-4" style={{ isolation: "isolate" }}>

                {/* Role header */}
                {selectedRoleData && (
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <div className={`w-11 h-11 ${selectedRoleData.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                      <selectedRoleData.icon className={`w-5 h-5 ${selectedRoleData.iconColor}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold leading-tight"
                        style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}>
                        Sign up as {selectedRoleData.label}
                      </h2>
                      <p className="text-xs text-gray-400">{selectedRoleData.description}</p>
                    </div>
                  </div>
                )}

                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <NativeField id="first_name" label="First Name" placeholder="John"
                    value={formData.first_name} required
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    icon={<Contact className="w-4 h-4 text-gray-400" />} />
                  <NativeField id="last_name" label="Last Name" placeholder="Doe"
                    value={formData.last_name} required
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    icon={<Contact className="w-4 h-4 text-gray-400" />} />
                </div>

                {/* Email */}
                <NativeField id="email" label="Email Address" type="email"
                  placeholder="you@example.com" value={formData.email} required
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  icon={<Mail className="w-4 h-4 text-gray-400" />} />

                {/* Phone — keep original component */}
                <PhoneInput label="Phone Number" required value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })} />

                {/* Agent-specific fields */}
                {selectedRole === "agent" && (
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <p className="text-sm font-bold" style={{ color: "#1B3E5D", fontFamily: "'DM Sans', sans-serif" }}>
                      Agent Details
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="ID Type" value={agentData.government_id_type}
                        onChange={(e) => setAgentData({ ...agentData, government_id_type: e.target.value })}
                        options={[
                          { value: "NIN", label: "NIN" },
                          { value: "Passport", label: "Intl Passport" },
                          { value: "VoterID", label: "Voter ID" },
                        ]} />
                      <NativeField id="id_number" label="ID Number" placeholder="Enter ID Number"
                        value={agentData.government_id_number} required
                        onChange={(e) => setAgentData({ ...agentData, government_id_number: e.target.value })}
                        icon={<FileText className="w-4 h-4 text-gray-400" />} />
                    </div>

                    <div className="py-1">
                      <LocationInput label="Agent Location"
                        value={{ city: agentData.city, state: agentData.state, country: agentData.country, countryCode: agentData.countryCode, stateCode: agentData.stateCode }}
                        onChange={(location) => setAgentData((prev) => ({ ...prev, ...location }))}
                        required placeholder="Search for city..." />
                    </div>

                    {/* Gov ID upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Upload Government ID
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="file" accept="image/*"
                          onChange={(e) => handleFileChange(e, "government_id_image")}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1B3E5D]/10 file:text-[#1B3E5D] hover:file:bg-[#1B3E5D]/20" />
                        {agentData.government_id_image && <span className="text-green-600 text-xs font-semibold shrink-0">✓ Uploaded</span>}
                      </div>
                    </div>

                    {/* Profile photo upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Upload Profile Photo
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="file" accept="image/*"
                          onChange={(e) => handleFileChange(e, "profile_photo")}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1B3E5D]/10 file:text-[#1B3E5D] hover:file:bg-[#1B3E5D]/20" />
                        {agentData.profile_photo && <span className="text-green-600 text-xs font-semibold shrink-0">✓ Uploaded</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Password */}
                <NativeField id="password" label="Password" type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password" value={formData.password} required
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  icon={<Lock className="w-4 h-4 text-gray-400" />}
                  rightEl={
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#9CA3AF" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  } />

                {/* Confirm Password */}
                <NativeField id="confirmPassword" label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password" value={formData.confirmPassword} required
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  icon={<Lock className="w-4 h-4 text-gray-400" />}
                  rightEl={
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#9CA3AF" }}>
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  } />

                {/* Password mismatch hint */}
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500 -mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Passwords do not match
                  </p>
                )}

                {/* Submit */}
                <Button type="submit" loading={loading} fullWidth variant="primary"
                  className="btn-signup h-12 text-sm font-bold bg-[#1B3E5D] shadow-md cursor-pointer rounded-xl tracking-wide"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Create Account
                </Button>

                {/* Back */}
                <button type="button"
                  onClick={() => { setStep("role"); setSelectedRole(""); }}
                  className="link-signin w-full text-sm font-semibold text-[#1B3E5D]/60 hover:text-[#1B3E5D] py-1 transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif", background: "none", border: "none", cursor: "pointer" }}>
                  ← Back to Role Selection
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}